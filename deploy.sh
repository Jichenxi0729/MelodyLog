#!/bin/bash

# MelodyLog 云服务器部署脚本
# 适用于 Ubuntu 20.04/22.04 LTS

set -e

echo "========================================"
echo "MelodyLog 应用部署脚本"
echo "========================================"

# 配置变量
APP_NAME="melodylog"
APP_DIR="/var/www/$APP_NAME"
GITHUB_REPO="" # 请在运行脚本时提供仓库URL
NODE_VERSION="16"
PM2_NAME="$APP_NAME"
PORT="3000"
DOMAIN="" # 请在运行脚本时提供域名
INSTALL_NGINX=false
INSTALL_CERTBOT=false

# 显示帮助信息
show_help() {
    echo "使用方法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -r, --repo <仓库URL>      设置Git仓库URL"
    echo "  -d, --domain <域名>       设置域名（用于Nginx和SSL）"
    echo "  -n, --nginx               安装并配置Nginx"
    echo "  -s, --ssl                 安装Certbot并配置SSL证书"
    echo "  -h, --help                显示此帮助信息"
    echo ""
    echo "示例: $0 --repo https://github.com/yourusername/melodylog.git --domain melodylog.com --nginx --ssl"
}

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -r|--repo)
            GITHUB_REPO="$2"
            shift 2
            ;;
        -d|--domain)
            DOMAIN="$2"
            shift 2
            ;;
        -n|--nginx)
            INSTALL_NGINX=true
            shift
            ;;
        -s|--ssl)
            INSTALL_CERTBOT=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
done

# 检查必要参数
if [ -z "$GITHUB_REPO" ]; then
    echo "错误: 必须提供Git仓库URL"
    show_help
    exit 1
fi

# 如果选择SSL但没有提供域名
if [ "$INSTALL_CERTBOT" = true ] && [ -z "$DOMAIN" ]; then
    echo "错误: 配置SSL证书需要提供域名"
    show_help
    exit 1
fi

# 如果选择SSL但没有选择Nginx
if [ "$INSTALL_CERTBOT" = true ] && [ "$INSTALL_NGINX" = false ]; then
    echo "警告: SSL配置需要Nginx，将自动安装Nginx"
    INSTALL_NGINX=true
fi

# 更新系统
echo "更新系统..."
sudo apt update
sudo apt upgrade -y

# 安装必要的系统依赖
echo "安装系统依赖..."
sudo apt install -y git curl wget build-essential

# 安装Node.js和npm
echo "安装Node.js $NODE_VERSION 和 npm..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
echo "验证Node.js和npm版本..."
node -v
npm -v

# 创建应用目录
echo "创建应用目录..."
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# 克隆代码
echo "克隆代码仓库..."
if [ -d "$APP_DIR/.git" ]; then
    echo "更新现有仓库..."
    cd $APP_DIR
    git pull
else
    git clone $GITHUB_REPO $APP_DIR
    cd $APP_DIR
fi

# 安装项目依赖
echo "安装项目依赖..."
npm install

# 创建环境变量文件（如果不存在）
if [ ! -f ".env.local" ]; then
    echo "创建.env.local文件..."
    cat > .env.local << EOF
PORT=$PORT
GEMINI_API_KEY=your_gemini_api_key_here
NODE_ENV=production
EOF
    echo "请编辑 .env.local 文件，添加正确的 GEMINI_API_KEY"
fi

# 构建应用
echo "构建生产版本..."
npm run build

# 安装PM2
echo "安装PM2..."
sudo npm install -g pm2

# 停止现有进程（如果存在）
if pm2 id $PM2_NAME &> /dev/null; then
    echo "停止现有进程..."
    pm2 stop $PM2_NAME
    pm2 delete $PM2_NAME
fi

# 启动应用
echo "使用PM2启动应用..."
pm start

# 配置PM2开机自启
echo "配置PM2开机自启..."
sudo pm2 startup systemd -u $USER --hp $(eval echo ~$USER)
pm2 save

# 安装和配置Nginx
if [ "$INSTALL_NGINX" = true ]; then
    echo "安装Nginx..."
    sudo apt install -y nginx
    
    # 配置Nginx
    echo "配置Nginx..."
    sudo tee /etc/nginx/sites-available/$APP_NAME << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # 静态资源缓存配置
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }
}
EOF
    
    # 启用配置
    sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # 测试Nginx配置
    sudo nginx -t
    
    # 重启Nginx
    sudo systemctl restart nginx
    sudo systemctl enable nginx
    
    echo "Nginx已配置并启动"
fi

# 配置防火墙
if command -v ufw &> /dev/null; then
    echo "配置防火墙..."
    sudo ufw allow 'Nginx Full' || sudo ufw allow 'Nginx HTTP' || sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw allow $PORT/tcp
    echo "y" | sudo ufw enable
    sudo ufw status
fi

# 安装和配置SSL证书
if [ "$INSTALL_CERTBOT" = true ]; then
    echo "安装Certbot..."
    sudo apt install -y certbot python3-certbot-nginx
    
    # 获取SSL证书
    echo "获取SSL证书..."
    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
    
    # 配置自动续期
    echo "配置证书自动续期..."
    sudo certbot renew --dry-run
    
    echo "SSL证书已配置"
fi

echo "========================================"
echo "部署完成！"
echo "========================================"
echo "应用信息:"
echo "- 应用目录: $APP_DIR"
echo "- 运行端口: $PORT"
echo "- PM2名称: $PM2_NAME"
if [ -n "$DOMAIN" ]; then
    if [ "$INSTALL_CERTBOT" = true ]; then
        echo "- 应用访问地址: https://$DOMAIN"
    else
        echo "- 应用访问地址: http://$DOMAIN"
    fi
else
    echo "- 应用访问地址: http://服务器IP:$PORT"
fi
echo ""
echo "管理命令:"
echo "- 查看应用状态: pm2 status $PM2_NAME"
echo "- 查看应用日志: pm2 logs $PM2_NAME"
echo "- 重启应用: pm2 restart $PM2_NAME"
echo "- 停止应用: pm2 stop $PM2_NAME"
echo ""
echo "请确保在 .env.local 文件中配置正确的 GEMINI_API_KEY"
