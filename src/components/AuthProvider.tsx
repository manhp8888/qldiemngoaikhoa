
import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userRole: string | null;
  userName: string | null;
  signOut: () => Promise<void>;
  session: Session | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  userRole: null,
  userName: null,
  session: null,
  signOut: async () => {}
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching user profile:', error);
        return { role: null, fullName: null };
      }
      
      return { 
        role: data?.role || null,
        fullName: data?.full_name || null
      };
    } catch (err) {
      console.error('Unknown error fetching user profile:', err);
      return { role: null, fullName: null };
    }
  };

  useEffect(() => {
    // Check current session
    const checkSession = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          setLoading(false);
          return;
        }
        
        setSession(data.session);
        
        const currentUser = data.session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          try {
            const { role, fullName } = await fetchUserProfile(currentUser.id);
            setUserRole(role);
            setUserName(fullName);
          } catch (err) {
            console.error('Error fetching user profile:', err);
          }
        } else {
          setUserRole(null);
          setUserName(null);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error checking session:', error);
        setLoading(false);
      }
    };
    
    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const { role, fullName } = await fetchUserProfile(currentUser.id);
          setUserRole(role);
          setUserName(fullName);
          
          // If user just signed in, navigate to dashboard
          if (event === 'SIGNED_IN') {
            navigate('/dashboard');
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
        }
      } else {
        setUserRole(null);
        setUserName(null);
        
        // If user just signed out, navigate to auth page
        if (event === 'SIGNED_OUT') {
          navigate('/auth');
        }
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error signing out:', error);
        toast.error('Đăng xuất không thành công: ' + error.message);
      } else {
        toast.success('Đã đăng xuất thành công');
      }
      
      setLoading(false);
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast.error('Đăng xuất không thành công: ' + error.message);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, userRole, userName, signOut, session }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
