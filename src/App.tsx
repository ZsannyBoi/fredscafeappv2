import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
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
import { User, PlacedOrderItemDetail, NewOrderData } from './types'; // Keep needed types
import { v4 as uuidv4 } from 'uuid';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activePage, setActivePage] = useState<string>('Home');
  const [authChecked, setAuthChecked] = useState<boolean>(false); // State to track initial auth check

  // --- Check for existing token on initial load ---
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        // Basic check: Decode token to get user info without verifying signature here
        // Verification happens in authenticateToken middleware on API calls
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        const decodedUser = JSON.parse(jsonPayload);
        
        // Reconstruct the User object for the state
        // IMPORTANT: Trusting the decoded payload. Ideally, fetch user from backend /verify endpoint.
        setUser({
          id: decodedUser.userId?.toString(), // Ensure ID is string
          name: decodedUser.name,
          role: decodedUser.role,
          // Add avatar/referral code if they are included in your JWT payload
          // avatar: decodedUser.avatar, 
          // referralCode: decodedUser.referralCode
        });
        console.log("Restored session for user:", decodedUser.name);
      } catch (error) {
        console.error("Error decoding token on load:", error);
        localStorage.removeItem('authToken'); // Clear invalid token
        setUser(null);
      }
    }
    setAuthChecked(true); // Mark authentication check as complete
  }, []);

  const placeNewOrder = async (newOrderData: NewOrderData) => {
    if (!user) { 
      console.error("Cannot place order: No authenticated user found.");
      alert("Authentication error. Please log in again.");
      throw new Error("User not authenticated");
    }

    const token = localStorage.getItem('authToken'); 

    try {
      const response = await fetch('http://localhost:3001/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          // customerId: user.id, // Backend gets ID from token if customer
          customerName: newOrderData.customerName, 
          items: newOrderData.items,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to place order. Server returned an error.' }));
        console.error("API Error placing order:", errorData);
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const savedOrder: any = await response.json(); // Use 'any' or create a backend response type
      // Order state removed, maybe show success message?
      console.log("Order successfully placed via API:", savedOrder);
      // alert(`Order #${savedOrder.ticketNumber} placed successfully!`); // Optional feedback

    } catch (error) {
      console.error("Error in placeNewOrder API call:", error);
      throw error; // Re-throw for Menu.tsx to handle
    }
  };

  const handleLogin = async (username: string, password: string) => {
      try {
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
  
        if (data.token && data.user) {
          localStorage.setItem('authToken', data.token);
          setUser(data.user);
      setActivePage('Home');
    } else {
          throw new Error('Login failed: Invalid response from server.');
        }
  
      } catch (error) {
        console.error("Login error:", error);
        alert(error instanceof Error ? error.message : 'An unknown login error occurred.');
        setUser(null);
        localStorage.removeItem('authToken');
    }
  };

  const handleLogout = () => {
      localStorage.removeItem('authToken');
      setUser(null);
      setActivePage('Home'); // Navigate to login/home after logout
  };

  // Render loading state until auth check is complete
  if (!authChecked) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>; // Or a spinner component
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />; // Removed unused props
  }

  const renderPage = () => {
    const UnauthorizedOrHome = () => {
      alert("You do not have access to this page or it doesn\'t exist for your role. Returning to Home.");
      // Home now fetches its own data
      return <Home user={user} setActivePage={setActivePage} />;
    }

    switch (activePage) {
      case 'Home':
        // Pass only necessary props
        return <Home user={user} setActivePage={setActivePage} />;
      case 'Menu': 
        return <Menu placeNewOrder={placeNewOrder} user={user} />;
      case 'Rewards':
        if (['manager', 'employee', 'cashier', 'customer'].includes(user.role)) {
          // Determine target customer ID - staff defaults to showing their own info or a placeholder
          // This logic might need refinement based on actual workflow
          const targetCustomerIdForView = user.role === 'customer' ? user.id : user.id; // Staff view own ID for now
          
          // Rewards.tsx now fetches its own data using targetCustomerIdForView
          return <Rewards targetCustomerId={targetCustomerIdForView} user={user} />;
        }
        return <UnauthorizedOrHome />;
      case 'Profile':
        return <Profile user={user} />;
      case 'Settings':
        return <Settings />;
      case 'Logout':
        return <Logout onLogout={handleLogout} />;
      case 'Orders':
        if (['manager', 'employee', 'cook'].includes(user.role)) {
          return <Order user={user} />;
        }
        return <UnauthorizedOrHome />;
      case 'Edit Menu':
        if (user.role === 'manager') {
          return <EditMenu />;
        }
        return <UnauthorizedOrHome />;
      case 'Edit Rewards':
        if (user.role === 'manager') {
          // EditRewards now fetches its own data. Keep grantVoucherFunction for now.
          // grantVoucherFunction likely needs API call inside EditRewards too eventually.
          return <EditRewards
                      // rewardsData removed 
                      // onAddReward, onUpdateReward, onDeleteReward removed (needs API calls)
                      grantVoucherFunction={() => alert('Grant voucher via API needed')} // Placeholder
                      loggedInUser={user}
                   />;
        }
        return <UnauthorizedOrHome />;
      case 'Employee':
        if (user.role === 'manager') {
          return <Employee />;
        }
        return <UnauthorizedOrHome />;
      default:
        return <UnauthorizedOrHome />;
    }
  };

  return (
    <Router>
      <div className="app flex h-screen bg-stone-100 overflow-hidden">
        <Sidebar userRole={user.role} activePage={activePage} setActivePage={setActivePage} onLogout={handleLogout}/>
        <div className="content flex-1 p-6 overflow-y-auto">
          {renderPage()}
        </div>
      </div>
    </Router>
  );
}

interface LoginPageProps {
  onLogin: (username: string, password: string) => void;
}

const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [loginFormData, setLoginFormData] = useState({
    email: '',
    password: ''         
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
      setLoginFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(loginFormData.email, loginFormData.password);
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
              {/* Removed Placeholder Text */}
               {/* <h1 className="text-6xl font-serif text-white mt-10">PLACEHOLDER<br />TEXT</h1> */}
         </div>
      </div>

      {/* Right Login Section */} 
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-sm"> {/* Reduced max-width slightly */}
          <div className="text-center mb-10">
            {/* Replace with your actual logo */}
            <img src="/src/assets/logo.svg" alt="EspressoLane Logo" className="h-10 mx-auto mb-5" /> 
            <h2 className="text-2xl font-medium text-brown-800">Login</h2>
          </div>

          {/* Form container for swipe animation */}
          <div className="auth-form-container w-full relative overflow-hidden" style={{ height: 'auto' }}> {/* Adjust height as needed or make dynamic */}
            <div 
              className="flex transition-transform duration-300 ease-in-out"
            >
              {/* Login Form Slide */}
              <div className="auth-form w-full flex-shrink-0 px-4"> {/* Added px-4 for consistency */}
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
                    <button type="button" className="text-sm font-medium text-gray-500 hover:text-brown-600">
                  Forgotten password?
                    </button>
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors font-semibold"
            >
              Login
            </button>
            <p className="text-center text-sm text-gray-500">
              Don\'t have an account? 
                    <button type="button" className="font-medium text-blue-600 hover:text-blue-700 ml-1">
                Sign up now
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
