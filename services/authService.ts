import { supabase } from './supabaseService';

// 用户类型定义
export interface User {
  id: string;
  email: string;
  username?: string;
  created_at: string;
  user_metadata?: {
    username?: string;
    name?: string;
    full_name?: string;
    avatar_url?: string;
  };
}

// 注册新用户
export async function signUp(email: string, password: string, username?: string): Promise<{ user: User | null; error: Error | null }> {
  try {
    console.log('Calling supabase.auth.signUp() with email:', email);
    const result = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
        // 注册成功后发送确认邮件
        emailRedirectTo: window.location.origin,
      },
    });
    console.log('supabase.auth.signUp() result:', result);
    
    const { data, error } = result;
    
    if (error) {
      console.log('supabase.auth.signUp() returned error:', error);
      return {
        user: null,
        error: error as Error,
      };
    }
    
    console.log('Sign up successful, user:', data?.user);
    
    // 返回注册结果，不自动登录
    return {
      user: data.user as User | null,
      error: null,
    };
  } catch (error: any) {
    console.error('Error in signUp catch block:', error);
    return {
      user: null,
      error: error as Error,
    };
  }
}

// 用户登录
export async function signIn(email: string, password: string): Promise<{ user: User | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // 不再绕过邮箱确认，直接返回登录结果
    return {
      user: data?.user as User | null,
      error,
    };
  } catch (error: any) {
    console.error('Error in signIn catch block:', error);
    return {
      user: null,
      error: error as Error,
    };
  }
}

// 用户登出
export async function signOut(): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signOut();
  return { error };
}

// 获取当前登录用户
export async function getCurrentUser(): Promise<{ user: User | null; error: Error | null }> {
  try {
    const result = await supabase.auth.getUser();
    
    // 检查是否有错误
    if (result.error) {
      // 无论错误信息如何，只要是supabase.auth.getUser()返回的错误，都视为认证会话问题
      // 直接返回null用户，不传递错误
      return { user: null, error: null };
    }
    
    return {
      user: result.data?.user as User | null,
      error: null,
    };
  } catch (error) {
    // 捕获任何异常，视为认证会话问题
    return { user: null, error: null };
  }
}

// 监听用户认证状态变化
export function onAuthStateChange(callback: (user: User | null) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user as User | null);
  });
}
