import { BrowserRouter as Router, Route, Routes, Navigate, Link } from 'react-router-dom';
import React, { useState, useEffect, useCallback } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Rewards from './pages/Rewards';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Logout from './pages/Logout';
import Order from './pages/Order';
import EditMenu from './pages/EditMenu';
import Employee from './pages/Employee';
import EditRewards from './pages/EditRewards';
import TestApproval from './pages/TestApproval';
import CheckoutSuccess from './pages/CheckoutSuccess';
import ResetPassword from './pages/ResetPassword';
import LandingPage from './pages/LandingPage';
import { User, PlacedOrderItemDetail, NewOrderData, OrderResponse } from './types'; // Keep needed types
import { v4 as uuidv4 } from 'uuid';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activePage, setActivePage] = useState<string>('Home');
  const [authChecked, setAuthChecked] = useState<boolean>(false); // State to track initial auth check
  const [authError, setAuthError] = useState<string | null>(null); // Track auth errors for UI
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null); // Add state for selected order
  const [showLoginForm, setShowLoginForm] = useState<'login' | 'signup' | 'forgotPassword'>('login');

  // --- Check for existing token and fetch user data on initial load ---
  useEffect(() => {
    console.log('[App.tsx] useEffect running. authChecked:', authChecked, 'user:', user ? 'exists' : 'null');
    const loadUserFromToken = async () => {
      const token = localStorage.getItem('authToken');
      console.log('[App.tsx] loadUserFromToken called. Token found:', !!token);
      if (token) {
        try {
          console.log('[App.tsx] Attempting to verify token via /api/auth/verify');
          // Instead of just decoding, call backend to verify token and get full user data
          const response = await fetch('http://localhost:3001/api/auth/verify', {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          console.log('[App.tsx] /api/auth/verify response status:', response.status);

          if (!response.ok) {
            localStorage.removeItem('authToken'); // Invalid token
            console.error('[App.tsx] Token verification failed. Clearing token.');
            throw new Error('Token verification failed.');
          }

          const data = await response.json();
          console.log('[App.tsx] /api/auth/verify response data:', data);
          if (data.user) {
            // Set user state with full data from backend
            console.log('[App.tsx] Setting user state from verified data.', data.user);
            setUser({
                internalId: data.user.internalId || '', // Use internalId from backend response
                email: data.user.email || '', // Use backend email for email
                name: data.user.name,
                role: data.user.role,
                avatar: data.user.avatar || undefined, // Match field names with backend
                referralCode: data.user.referralCode || undefined, // Match field names with backend
                phone_number: data.user.phone_number || undefined,
                address: data.user.address || undefined,
            });
            console.log('[App.tsx] User state set successfully from verification.');
            console.log('[App.tsx] User state value after setUser (verification):', user);
            setAuthError(null);
          } else {
             localStorage.removeItem('authToken');
             console.error('[App.tsx] Token valid but user data missing in response.', data);
             throw new Error('Token valid but user data missing in response.');
          }

        } catch (error: any) {
          console.error('[App.tsx] Authentication error on load catch:', error);
          localStorage.removeItem('authToken');
          setUser(null);
          setAuthError(error.message || 'Authentication failed.');
        }
      } else {
        console.log('[App.tsx] No auth token found in localStorage.');
        setUser(null); // No token found
        setAuthError(null); // Clear auth error if no token
      }
      console.log('[App.tsx] Setting authChecked to true.');
      setAuthChecked(true); // Mark authentication check as complete
    };

    // Only run loadUserFromToken if auth has not been checked yet
    if (!authChecked) {
      loadUserFromToken();
    }
  }, [authChecked]); // Re-run if authChecked changes (should only happen once)

  // --- Function to update user state in App.tsx ---
  const updateUser = (userData: Partial<User>) => {
      setUser(prevUser => prevUser ? { ...prevUser, ...userData } : null);
  };

  const placeNewOrder = async (newOrderData: NewOrderData): Promise<OrderResponse> => {
    if (!user) {
      console.error("Cannot place order: No authenticated user found.");
      alert("Authentication error. Please log in again.");
      throw new Error("User not authenticated");
    }

    const token = localStorage.getItem('authToken');

    try {
      // Use our new checkout endpoint that requires approval
      const response = await fetch('http://localhost:3001/api/orders/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(newOrderData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to place order. Server returned an error.' }));
        console.error("API Error placing order:", errorData);
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const orderResult = await response.json();
      
      if (orderResult.approvalUrl) {
        // Open approval URL in a new window with specific dimensions
        const approvalWindow = window.open(
          orderResult.approvalUrl, 
          '_blank',
          'width=800,height=600,resizable=yes,scrollbars=yes'
        );
        
        if (!approvalWindow) {
          throw new Error('Please allow popups for this site to complete the order process.');
        }
        
        // Create a promise that resolves when the order is completed
        return new Promise((resolve, reject) => {
          const messageHandler = (event: MessageEvent) => {
            if (event.data.type === 'ORDER_COMPLETED') {
              // Remove the event listener
              window.removeEventListener('message', messageHandler);
              // Resolve the promise with order details
              resolve({
                id: orderResult.orderId,
                timestamp: orderResult.timestamp || new Date().toISOString(),
                ticketNumber: orderResult.ticketNumber || 'N/A',
              });
            } else if (event.data.type === 'ORDER_REJECTED') {
              // Remove the event listener
              window.removeEventListener('message', messageHandler);
              // Reject the promise with the rejection reason
              reject(new Error(event.data.reason || 'Order was rejected'));
            }
          };
          
          // Add the event listener
          window.addEventListener('message', messageHandler);
          
          // Set a timeout to reject if no response is received
          setTimeout(() => {
            window.removeEventListener('message', messageHandler);
            reject(new Error('Order approval timed out'));
          }, 300000); // 5 minute timeout
        });
      } else {
        console.log("Order processing initiated:", orderResult);
        // Return order details
        return {
          id: orderResult.orderId || orderResult.id,
          timestamp: orderResult.timestamp || new Date().toISOString(),
          ticketNumber: orderResult.ticketNumber || orderResult.ticket_number || 'N/A',
        };
      }

    } catch (error) {
      console.error("Error in placeNewOrder API call:", error);
      throw error; // Re-throw for Menu.tsx to handle
    }
  };

  const handleLogin = async (username: string, password: string) => {
      try {
        console.log('[App.tsx] handleLogin called for:', username);
        const response = await fetch('http://localhost:3001/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: username, password: password }),
        });
  
        if (!response.ok) {
          let errorMessage = `Login failed: ${response.statusText}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } catch (parseError) { /* Ignore */ }
          throw new Error(errorMessage);
        }
  
        const data = await response.json();
        console.log('[App.tsx] Login API response data:', data);
  
        if (data.token && data.user) {
          console.log('[App.tsx] Login successful. Setting token and user state.', data);
          localStorage.setItem('authToken', data.token);
          // Ensure user object from login includes avatar and referralCode if available
          setUser({
                internalId: data.user.internalId || '', // Use internalId from backend response
                email: data.user.email || '', // Use backend email for email
                name: data.user.name,
                role: data.user.role,
                avatar: data.user.avatar || undefined, // Match field names with backend
                referralCode: data.user.referralCode || undefined, // Match field names with backend
                phone_number: data.user.phone_number || undefined,
                address: data.user.address || undefined,
          });
          console.log('[App.tsx] User state set successfully after login.');
          console.log('[App.tsx] User state value after setUser (login):', user);
          setAuthError(null);
        } else {
            console.error('[App.tsx] Login failed. Invalid response data.', data);
            throw new Error('Login failed: Invalid response from server.');
          }
  
      } catch (error) {
        console.error('[App.tsx] Login error catch:', error);
        alert(error instanceof Error ? error.message : 'An unknown login error occurred.');
        setUser(null);
        localStorage.removeItem('authToken');
        setAuthError(error instanceof Error ? error.message : 'An unknown login error occurred.');
    }
  };

  const handleLogout = () => {
      localStorage.removeItem('authToken');
      setUser(null);
      // We don't need to set activePage anymore since we'll navigate away
      // Navigate happens automatically via Routes when user becomes null
  };

  const grantVoucherFunction = async (customerId: string, rewardId: string, grantedByEmployeeId: string, notes?: string) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication token missing');
      }
      
      const response = await fetch('http://localhost:3001/api/rewards/grant-voucher', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customerId,
          rewardId,
          notes
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error ${response.status}`);
      }

      const result = await response.json();
      alert(`Voucher granted successfully! ID: ${result.voucherId}`);
      return result;
    } catch (error: any) {
      console.error('Error granting voucher:', error);
      alert(`Error granting voucher: ${error.message}`);
      throw error;
    }
  };

  // Render loading state until auth check is complete
  if (!authChecked) {
    console.log('[App.tsx] Rendering: Authentication not checked.');
    return <div className="flex items-center justify-center h-screen">Loading...</div>; // Or a spinner component
  }

  // Render authentication error if it occurred
  if (authError) {
    console.log('[App.tsx] Rendering: Authentication error.', authError);
    return <div className="flex items-center justify-center h-screen text-red-500">Authentication Error: {authError} <button onClick={() => { setAuthChecked(false); setAuthError(null); }} className="ml-2 px-2 py-1 bg-blue-500 text-white rounded rounded-lg">Retry</button></div>; // Simple retry button
  }

  // --- Authenticated app content ---
  const renderAuthenticatedApp = () => {
    return (
      <div className="app flex h-screen bg-stone-100 overflow-hidden">
        <Sidebar userRole={user!.role} activePage={activePage} setActivePage={setActivePage} onLogout={handleLogout}/>
        <div className="content flex-1 p-6 overflow-y-auto">
          {renderPage()}
        </div>
      </div>
    );
  };

  const renderPage = () => {
    const UnauthorizedOrHome = () => {
      // Redirect to Home if authorized, otherwise to login
      return <Navigate to="/dashboard" />;
    };

    // Ensure user and internalId are available before rendering pages that rely on them
    if (!user || !user.internalId) {
         console.log('[App.tsx] Rendering renderPage: User or user.internalId is missing.');
         return <Navigate to="/login" />;
    }

    switch (activePage) {
      case 'Home':
        return <Home user={user} setActivePage={setActivePage} setSelectedOrderId={setSelectedOrderId} />;
      case 'Menu':
        return <Menu placeNewOrder={placeNewOrder} user={user} />;
      case 'Rewards':
        if (['manager', 'employee', 'cashier', 'customer'].includes(user.role)) {
          const targetCustomerIdForView = user.internalId; // Use internalId
          return <Rewards targetCustomerId={targetCustomerIdForView} user={user} />;
        }
        return <Navigate to="/dashboard" />;
      case 'Profile':
        return <Profile user={user} updateUser={updateUser} />;
      case 'Settings':
        return <Settings user={user} updateUser={updateUser} />;
      case 'Logout':
        return <Logout onLogout={handleLogout} />;
      case 'Orders':
        if (['manager', 'employee', 'cook', 'cashier'].includes(user.role)) {
          return <Order user={user} selectedOrderId={selectedOrderId} setSelectedOrderId={setSelectedOrderId} />;
        }
        return <Navigate to="/dashboard" />;
      case 'Edit Menu':
        if (user.role === 'manager') {
          return <EditMenu />;
        }
        return <Navigate to="/dashboard" />;
      case 'Edit Rewards':
        if (user.role === 'manager' || user.role === 'cashier') {
          return <EditRewards
                      grantVoucherFunction={grantVoucherFunction}
                      loggedInUser={user}
                   />;
        }
        return <Navigate to="/dashboard" />;
      case 'Employee':
        if (user.role === 'manager') {
          return <Employee />;
        }
        return <Navigate to="/dashboard" />;
      default:
        return <Navigate to="/dashboard" />;
    }
  };

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={
          user ? <Navigate to="/dashboard" /> : <LoginPage onLogin={handleLogin} initialForm="login" />
        } />
        <Route path="/register" element={
          user ? <Navigate to="/dashboard" /> : <LoginPage onLogin={handleLogin} initialForm="signup" />
        } />
        <Route path="/test-approval" element={<TestApproval />} />
        <Route path="/checkout-success" element={<CheckoutSuccess />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Protected routes - redirect to landing if not authenticated */}
        <Route path="/dashboard/*" element={
          user ? renderAuthenticatedApp() : <Navigate to="/login" />
        } />
        
        {/* Fallback route - redirect to landing or dashboard based on auth state */}
        <Route path="*" element={
          user ? <Navigate to="/dashboard" /> : <Navigate to="/" />
        } />
      </Routes>
      <ToastContainer />
    </Router>
  );
}

interface LoginPageProps {
  onLogin: (username: string, password: string) => void;
  initialForm?: 'login' | 'signup' | 'forgotPassword';
}

const LoginPage = ({ onLogin, initialForm = 'login' }: LoginPageProps) => {
  const [loginFormData, setLoginFormData] = useState({
    email: '',
    password: ''
  });
  
  // --- New State for Signup Form ---
  const [signupFormData, setSignupFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    referralCode: ''
  });

  // --- New State for Form Toggling ---
  const [currentForm, setCurrentForm] = useState<'login' | 'signup' | 'forgotPassword'>(initialForm); // Use initialForm prop
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Handle input change for both login and signup forms based on currentForm
    if (currentForm === 'login') {
      setLoginFormData(prev => ({ ...prev, [name]: value }));
    } else if (currentForm === 'signup') {
      setSignupFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); // Clear previous errors
    setLoading(true); // Set loading state
    onLogin(loginFormData.email, loginFormData.password);
    // Loading and error handling will be managed by the onLogin prop's completion
    setLoading(false); // Assuming onLogin handles its own loading/error or updates user state
  };

  // --- New Signup Submit Handler ---
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); // Clear previous errors
    
    const { name, email, password, confirmPassword, referralCode } = signupFormData;

    // Basic Validation
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    // Add more robust email/password validation here if needed

    setLoading(true); // Set loading state

    try {
      const response = await fetch('http://localhost:3001/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, referralCode: referralCode || undefined }), // Include referralCode if provided
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle API errors (e.g., email already in use)
        setError(data.message || 'Signup failed.');
        setLoading(false);
        return;
      }

      // Signup successful, maybe show a success message and switch to login
      alert('Signup successful! Please log in.');
      // Optionally pre-fill login form with new email:
      // setLoginFormData(prev => ({ ...prev, email: signupFormData.email }));
      setShowLogin(); // Switch to login form

    } catch (err: any) {
      console.error("Signup error:", err);
      setError(err.message || 'An unexpected error occurred during signup.');
    } finally {
      setLoading(false); // Always hide loading state
    }
  };

  // Handle Forgot Password Submit
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    // Get email from the form
    const form = e.target as HTMLFormElement;
    const emailInput = form.querySelector('input[name="email-forgot"]') as HTMLInputElement;
    const email = emailInput.value;
    
    if (!email) {
      setError('Please enter your email address.');
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch('http://localhost:3001/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.message || 'Password reset request failed.');
        setLoading(false);
        return;
      }
      
      // Open the approval URL in a new tab
      if (data.approvalUrl) {
        window.open(data.approvalUrl, '_blank', 'width=600,height=800');
        alert('A password reset window has been opened. Please complete the process in the new window.');
      }
      
      // Show success message and return to login form
      setShowLogin();
      
    } catch (err: any) {
      console.error("Forgot password error:", err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const setShowSignup = () => {
    setCurrentForm('signup');
    setError(null); // Clear errors when switching forms
    setLoading(false); // Reset loading state
  };

  const setShowForgotPassword = () => {
    setCurrentForm('forgotPassword');
    setError(null); // Clear errors when switching forms
    setLoading(false); // Reset loading state
  };

  const setShowLogin = () => {
    setCurrentForm('login');
    setError(null); // Clear errors when switching forms
    setLoading(false); // Reset loading state
  };


  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Banner Section */} 
      <div className="hidden lg:block lg:w-1/2 relative bg-brown-50">
        {/* Background Image */}
        <img 
          src="/src/assets/banner.jpg" 
          alt="Coffee Beans" 
          className="w-full h-full object-cover"
        />
         {/* Gradient Overlay and Text - Adjusted to top alignment */}
         <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent flex flex-col justify-start pt-16 px-16 pb-8"> 
             {/* Text content needs styling - example */}
              {/* Changed heading color to text-stone-50 */}
              <h1 className="text-5xl font-bold text-stone-50 mb-4 leading-tight">EspressoLane</h1> 
              <p className="text-xl text-gray-200 max-w-md">
                Manage your cafe operations seamlessly, from orders to employees.
             </p>
             {/* Added Back to Home link */}
             <Link to="/" className="text-white hover:text-emerald-200 mt-8 inline-flex items-center font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Back to Home
             </Link>
         </div>
      </div>

      {/* Right Login/Signup/Forgot Password Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-sm"> {/* Reduced max-width slightly */}
          {/* Mobile-only Back to Home link */}
          <div className="lg:hidden mb-6">
            <Link to="/" className="text-emerald-600 hover:text-emerald-700 flex items-center font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Back to Home
            </Link>
          </div>
          <div className="text-center mb-10">
            {/* Replace with your actual logo */}
            <img src="/src/assets/logo.svg" alt="EspressoLane Logo" className="h-10 mx-auto mb-5" />
            {/* Dynamic Heading based on current form */}
            <h2 className="text-2xl font-medium text-brown-800">{currentForm === 'login' ? 'Login' : currentForm === 'signup' ? 'Sign Up' : 'Reset Password'}</h2>
          </div>

          {/* Display Error Message */}
          {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-800 rounded-md text-sm">
                  {error}
              </div>
          )}

          {/* Form container for swipe animation */}
          {/* Adjusted style to make height dynamic */}
          <div className="auth-form-container w-full relative overflow-hidden" style={{ height: currentForm === 'login' ? 'auto' : currentForm === 'signup' ? 'auto' : 'auto' }}> {/* Adjust height calculation if needed */}
            <div
              className="flex transition-transform duration-300 ease-in-out"
              style={{ transform: currentForm === 'login' ? 'translateX(0)' : currentForm === 'signup' ? 'translateX(-100%)' : 'translateX(-200%)' }} // Add transform for slides
            >
              {/* Login Form Slide */}
              <div className="auth-form w-full flex-shrink-0 px-4">
                <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div>
              <input
                type="email"
                name="email"
                      id="email-login"
                      value={loginFormData.email}
                      onChange={handleInputChange}
                placeholder="Email"
                className="w-full px-4 py-4 rounded-xl border border-gray-200 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                required
              />
            </div>
            <div>
              <input
                type="password"
                name="password"
                      id="password-login"
                      value={loginFormData.password}
                      onChange={handleInputChange}
                placeholder="Password"
                className="w-full px-4 py-4 rounded-xl border border-gray-200 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                required
              />
            </div>
            <div className="flex items-center justify-end">
                    {/* Updated to call setShowForgotPassword */}
                    <button type="button" onClick={setShowForgotPassword} className="text-sm font-medium text-gray-500 hover:text-brown-600" disabled={loading}>
                  Forgotten password?
                    </button>
            </div>
            <button
              type="submit"
              className="w-full bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors font-semibold"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
            <p className="text-center text-sm text-gray-500">
              Don't have an account?
                    {/* Updated to call setShowSignup */}
                    <button type="button" onClick={setShowSignup} className="font-medium text-emerald-600 hover:text-emerald-700 ml-1" disabled={loading}>
                Sign up now
                    </button>
            </p>
          </form>
              </div>

              {/* --- Signup Form Slide --- */}
              <div className="auth-form w-full flex-shrink-0 px-4">
                {/* Update onSubmit and input values/onChange */}
                <form onSubmit={handleSignupSubmit} className="space-y-5">
                    <div>
                        <input
                            type="text"
                            name="name"
                            placeholder="Full Name"
                            value={signupFormData.name}
                            onChange={handleInputChange}
                            className="w-full px-4 py-4 rounded-xl border border-gray-200 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            required
                            disabled={loading}
                        />
                    </div>
                    <div>
                        <input
                            type="email"
                            name="email"
                            placeholder="Email"
                            value={signupFormData.email}
                            onChange={handleInputChange}
                            className="w-full px-4 py-4 rounded-xl border border-gray-200 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            required
                            disabled={loading}
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            name="password"
                            placeholder="Password"
                            value={signupFormData.password}
                            onChange={handleInputChange}
                            className="w-full px-4 py-4 rounded-xl border border-gray-200 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            required
                            disabled={loading}
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            name="confirmPassword"
                            placeholder="Confirm Password"
                            value={signupFormData.confirmPassword}
                            onChange={handleInputChange}
                            className="w-full px-4 py-4 rounded-xl border border-gray-200 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            required
                            disabled={loading}
                        />
                    </div>
                    {/* Optional: Add referral code input */}
                     <div>
                        <input
                           type="text"
                           name="referralCode"
                           placeholder="Referral Code (Optional)"
                           value={signupFormData.referralCode}
                           onChange={handleInputChange}
                           className="w-full px-4 py-4 rounded-xl border border-gray-200 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                           disabled={loading}
                        />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors font-semibold"
                      disabled={loading}
                    >
                        {loading ? 'Signing up...' : 'Sign Up'}
                    </button>
                     <p className="text-center text-sm text-gray-500">
                       Already have an account?
                       <button type="button" onClick={setShowLogin} className="font-medium text-emerald-600 hover:text-emerald-700 ml-1" disabled={loading}>
                         Login
                       </button>
                     </p>
                </form>
              </div>

              {/* --- Forgot Password Form Slide --- */}
               <div className="auth-form w-full flex-shrink-0 px-4">
                 {/* Update onSubmit and input values/onChange */}
                 <form onSubmit={handleForgotPasswordSubmit} className="space-y-5">
                     <p className="text-center text-gray-600 text-sm mb-4">Enter your email address below to receive instructions to reset your password.</p>
                     <div>
                         <input
                             type="email"
                             name="email-forgot"
                             placeholder="Email"
                             value={loginFormData.email} // Use login email state for simplicity or add new state if preferred
                             onChange={handleInputChange} // This will update loginFormData.email
                             className="w-full px-4 py-4 rounded-xl border border-gray-200 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                             required
                             disabled={loading}
                         />
                     </div>
                     <button
                       type="submit"
                       className="w-full bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors font-semibold"
                       disabled={loading}
                     >
                         {loading ? 'Sending...' : 'Reset Password'}
                     </button>
                     <p className="text-center text-sm text-gray-500">
                        Remember your password?
                        <button type="button" onClick={setShowLogin} className="font-medium text-emerald-600 hover:text-emerald-700 ml-1" disabled={loading}>
                           Login
                        </button>
                     </p>
                 </form>
               </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SidebarProps {
  userRole: 'manager' | 'employee' | 'cashier' | 'cook' | 'customer';
  activePage: string;
  setActivePage: (page: string) => void;
  onLogout: () => void; 
}

const Sidebar = ({ userRole, activePage, setActivePage, onLogout }: SidebarProps) => {
  const menuItems: Record<string, { icon: string; label: string }[]> = {
    manager: [
      { icon: 'home', label: 'Home' },
      { icon: 'menu', label: 'Menu' }, 
      { icon: 'order', label: 'Orders' },
      { icon: 'rewards', label: 'Rewards' },
      { icon: 'edit-menu', label: 'Edit Menu' },
      { icon: 'edit-rewards', label: 'Edit Rewards' },
      { icon: 'employee', label: 'Employee' },
      { icon: 'profile', label: 'Profile' },
      { icon: 'settings', label: 'Settings' },
    ],
    employee: [
      { icon: 'home', label: 'Home' },
      { icon: 'menu', label: 'Menu' },
      { icon: 'order', label: 'Orders' },
      { icon: 'profile', label: 'Profile' },
      { icon: 'settings', label: 'Settings' },
    ],
    cashier: [
      { icon: 'home', label: 'Home' },
      { icon: 'menu', label: 'Menu' },
      { icon: 'order', label: 'Orders' },
      { icon: 'edit-rewards', label: 'Edit Rewards' },
      { icon: 'profile', label: 'Profile' },
      { icon: 'settings', label: 'Settings' },
    ],
    cook: [
       { icon: 'menu', label: 'Menu' },
      { icon: 'order', label: 'Orders' },
      { icon: 'profile', label: 'Profile' },
      { icon: 'settings', label: 'Settings' },
    ],
    customer: [
      { icon: 'home', label: 'Home' },
      { icon: 'menu', label: 'Menu' },
      { icon: 'rewards', label: 'Rewards' },
      { icon: 'profile', label: 'Profile' },
      { icon: 'settings', label: 'Settings' },
    ],
  };
  const logoutItem = { icon: 'log-out', label: 'Logout' };

  const handleItemClick = (label: string) => {
      if (label === 'Logout') {
          onLogout();
      } else {
          setActivePage(label);
      }
  };

  return (
    <div className="w-20 bg-white border-r border-gray-100 h-screen flex flex-col py-6 shadow-sm">
      <div className="flex justify-center mb-8 pt-1">
         {/* Ensure logo uses a dark color compatible with white bg */}
        <img src="/src/assets/logo.svg" alt="Logo" className="h-8 text-gray-800" />
      </div>
      <nav className="flex-1 flex flex-col items-center space-y-2">
        {menuItems[userRole].map(({ icon, label }) => {
             const isSelected = activePage === label;
             return (
                <button
                    key={label}
                    onClick={() => handleItemClick(label)}
                    title={label} 
                    // Updated selected state: light green background, dark green text
                    className={`w-14 h-14 flex flex-col items-center justify-center rounded-xl transition-colors group relative text-[10px] leading-tight ${ 
                    isSelected
                        ? 'bg-emerald-50 text-emerald-700 font-medium' // Selected state
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700' // Unselected: gray text/icon, lighter gray on hover
                    }`}
                >
                    <img
                    src={`/src/assets/${icon}.svg`}
                    alt={label}
                    // Icon color mirrors button text color states
                    className={`h-5 w-5 mb-0.5 transition-colors ${isSelected ? 'text-emerald-700' : 'text-gray-400 group-hover:text-gray-700'}`}
                    />
                    <span>{label}</span>
                    {/* Optional: Re-add indicator if desired, perhaps using green */}
                    {/* {isSelected && (<div className="absolute left-0 w-1 h-8 bg-emerald-600 rounded-r-full" />)} */}
                </button>
            );
        })}
      </nav>
       {/* Logout Button styling adjusted */}
      <div className="mt-auto flex flex-col items-center pb-2">
           <button
             key={logoutItem.label}
             onClick={() => handleItemClick(logoutItem.label)}
             title={logoutItem.label}
             className={`w-14 h-14 flex flex-col items-center justify-center rounded-xl transition-colors group relative text-gray-500 hover:bg-gray-100 hover:text-gray-700 text-[10px] leading-tight`}
           >
             <img
               src={`/src/assets/${logoutItem.icon}.svg`}
               alt={logoutItem.label}
               className={`h-5 w-5 mb-0.5 text-gray-400 group-hover:text-gray-700 transition-colors`}
             />
             <span>{logoutItem.label}</span>
           </button>
      </div>
    </div>
  );
};

export default App
