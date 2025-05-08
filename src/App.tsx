import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { useState } from 'react';
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
import { RawRewardItem, CustomerInfo, User, OrderItem, PlacedOrderItemDetail, NewOrderData, CustomerVoucher, RawRewardItemCriteria } from './types'; // Import from types.ts
import { v4 as uuidv4 } from 'uuid'; // Import uuid

// Define shared types (in a real app, move to a shared types.ts file)
// export interface RawRewardItem { ... } // Remove this definition
// export interface CustomerInfo { ... } // Remove this definition

// Define user type
// interface User { ... } // Remove this definition

// Define a type for the items structure Menu.tsx will send
// export interface PlacedOrderItemDetail { ... }
// export interface NewOrderData { ... }

// Structure for storing basic mutable customer data
interface CustomerData {
  points: number;
  purchasesThisMonth: number; // Keep track here too
  // Add other trackable fields like lifetimeSpend, joinDate etc. as needed
}

// Update authenticateUser function
const authenticateUser = (username: string, password: string): User | null => {
  // In a real app, fetch user data and verify password hash
  // For demo, create richer user objects
  const getDemoName = (email: string) => {
    const namePart = email.split('@')[0];
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
  };

  const usersData: Record<string, { role: User['role']; name?: string; referralCode?: string }> = {
    'manager@business.org': { role: 'manager', name: 'Fredrick (Manager)' },
    'employee@business.org': { role: 'employee', name: 'Employee Eve' },
    'cashier@business.org': { role: 'cashier', name: 'Cashier Carl' },
    'cook@business.org': { role: 'cook', name: 'Cook Chris' },
    'customer@example.com': { role: 'customer', name: getDemoName('customer@example.com'), referralCode: 'CUSTOABCDE' },
    'juan@example.com': { role: 'customer', name: 'Juan Dela Cruz', referralCode: 'JUANDFGHI' }
  };

  if (usersData[username]) {
    const userData = usersData[username];
    return {
      id: username,
      role: userData.role,
      name: userData.name || getDemoName(username),
      referralCode: userData.referralCode || generateReferralCode(userData.name || getDemoName(username))
    };
  }

  // Fallback for simplified role detection if not in usersData (maintains previous behavior)
  if (username.includes('manager')) return { id: username, role: 'manager', name: getDemoName(username), referralCode: generateReferralCode(getDemoName(username)) };
  if (username.includes('employee')) return { id: username, role: 'employee', name: getDemoName(username), referralCode: generateReferralCode(getDemoName(username)) };
  if (username.includes('cashier')) return { id: username, role: 'cashier', name: getDemoName(username), referralCode: generateReferralCode(getDemoName(username)) };
  if (username.includes('cook')) return { id: username, role: 'cook', name: getDemoName(username), referralCode: generateReferralCode(getDemoName(username)) };
  if (username.includes('customer')) return { id: username, role: 'customer', name: getDemoName(username), referralCode: generateReferralCode(getDemoName(username)) };
  
  return null;
};

// Helper function to generate a referral code
const generateReferralCode = (name: string): string => {
  const namePart = name.split(' ')[0].toUpperCase().substring(0, 5); // First name, uppercase, max 5 chars
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase(); // 5 random alphanumeric chars
  return `${namePart}${randomSuffix}`;
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activePage, setActivePage] = useState<string>('Home');

  // Updated State for rewards data
  const [rewardsData, setRewardsData] = useState<RawRewardItem[]>([
    {
      id: 'r1',
      name: 'Free Birthday Latte',
      description: 'Enjoy a free standard latte on us during your birthday month!',
      image: '/src/assets/latte.png',
      type: 'standard',
      criteria: { isBirthMonthOnly: true },
      freeMenuItemIds: ['latte-standard-id'], // Assuming we have a product ID for a standard latte
      earningHint: 'Valid during your birthday month.'
    },
    {
      id: 'r2',
      name: '10% Off Next Order (5 Purchases)',
      description: 'Make 5 purchases this month to get 10% off your next order.',
      image: '/src/assets/coupon.png',
      type: 'discount_coupon',
      criteria: { minPurchasesMonthly: 5 },
      discountPercentage: 10,
      earningHint: 'Complete 5 purchases in a calendar month.'
    },
    {
      id: 'r3',
      name: 'Welcome Gift: 50 Bonus Points',
      image: '/src/assets/gift.svg',
      type: 'standard',
      description: 'Get 50 bonus points just for signing up!',
      criteria: { isSignUpBonus: true },
      // This reward itself doesn't have a pointsCost, it *grants* points.
      // The effect of granting points would be handled when this reward is "claimed" or automatically applied.
      earningHint: 'Awarded automatically when you join.'
      // We might need a separate mechanism or function to handle `grantsBonusPoints` from criteria upon eligibility or claim.
    },
    {
      id: 'r4',
      name: 'Free Croissant (Cost: 75 Points)',
      description: 'Redeem 75 loyalty points for a delicious free croissant.',
      image: '/src/assets/croissant.png',
      type: 'standard',
      criteria: { minPoints: 75 }, // Eligible if they have at least 75 points
      pointsCost: 75, // Costs 75 points to claim
      freeMenuItemIds: ['croissant-id'], // Assuming a product ID for croissant
      earningHint: 'Requires 75 available points to redeem.'
    },
    {
      id: 'emp_vouch_free_coffee',
      name: 'Employee Voucher: Free Coffee',
      description: 'A complimentary coffee, courtesy of our team!',
      image: '/src/assets/coffee-cup.png',
      type: 'manual_grant', // No criteria, granted by employee
      freeMenuItemIds: ['any-standard-coffee-id'],
      earningHint: 'This voucher is granted by an employee.'
    },
    {
      id: 'ref_new_user_bonus',
      name: 'Referral Welcome Bonus',
      description: 'Thanks for joining with a referral! Enjoy 50 bonus points.',
      image: '/src/assets/gift.svg',
      type: 'standard',
      criteria: { isReferralBonusForNewUser: true },
      // Effect: grants points, handled by registration logic for now
      earningHint: 'Awarded when you sign up using a valid referral code.'
    },
    {
      id: 'ref_referrer_bonus',
      name: 'Referral Thank You Bonus',
      description: 'You earned 25 bonus points for referring a new customer!',
      image: '/src/assets/gift.svg',
      type: 'standard',
      criteria: { isRewardForReferringUser: true },
      // Effect: grants points, handled by registration logic for now
      earningHint: 'Awarded when someone you referred signs up.'
    }
  ]);

  // State for ALL granted vouchers across customers
  const [allCustomerVouchers, setAllCustomerVouchers] = useState<CustomerVoucher[]>([]);

  // State for tracking claimed general (non-voucher) rewards per customer
  const [claimedGeneralRewardsByCustomer, setClaimedGeneralRewardsByCustomer] = useState<Record<string, Set<string>>>({});

  // State for basic mutable customer data (points, etc.)
  const [customerData, setCustomerData] = useState<Record<string, CustomerData>>({
    // Initialize with demo customer IDs from authenticateUser
    'customer@example.com': { points: 50, purchasesThisMonth: 2 },
    'juan@example.com': { points: 120, purchasesThisMonth: 6 }
    // Add other demo customers if needed
  });

  // CRUD functions for rewards (will need updates for new structure, especially for add/edit)
  const addReward = (newReward: Omit<RawRewardItem, 'id'>) => {
    setRewardsData(prev => [...prev, { ...newReward, id: uuidv4() }]);
  };
  const updateReward = (updatedReward: RawRewardItem) => {
    setRewardsData(prev => prev.map(r => r.id === updatedReward.id ? updatedReward : r));
  };
  const deleteReward = (rewardId: string) => {
    setRewardsData(prev => prev.filter(r => r.id !== rewardId));
  };
  
  // Customer Vouchers state (placeholder, will be managed per customer later)
  // For now, let's assume this is part of the `user` object when they log in, if they are a customer.
  // Or, App.tsx could hold a global list of all granted vouchers, and filter by user.id.
  // For simplicity now, we will add it to the customerInfoForRewards.

  // Orders State - Lifted from Order.tsx
  const [orders, setOrders] = useState<OrderItem[]>([
    {
      id: '1',
      customerId: 'customer@example.com', // Added customerId for the sample order
      customerName: 'John Doe',
      items: [
        {
          name: 'Hot Caramel Macchiato',
          quantity: 2,
          customizations: ['Large', '50% Sugar', 'Extra Shot']
        },
        {
          name: 'Croissant',
          quantity: 1,
          customizations: ['Warmed']
        }
      ],
      total: 15.97,
      status: 'pending',
      timestamp: '2024-01-20 10:30 AM',
      ticketNumber: '#ORD001'
    },
    // Add more sample orders if needed for testing
  ]);

  // Function to update order status
  const updateOrderStatus = (orderId: string, newStatus: OrderItem['status']) => {
    setOrders(prevOrders => {
      return prevOrders.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      );
    });
  };

  // Function to add a new order from Menu.tsx to the global orders list
  const placeNewOrder = (newOrderData: NewOrderData) => {
    if (!user || user.role !== 'customer') {
      console.error("Cannot place order: No authenticated customer found.");
      // Optionally, you could throw an error here or return a status
      // to be handled by the calling component (e.g., show a UI message).
      return; 
    }

    const newTicketNumber = `#ORD${(orders.length + 1).toString().padStart(3, '0')}`;
    
    const newOrder: OrderItem = {
      id: uuidv4(),
      customerId: user.id, // Now user.id is guaranteed to be a customer's ID
      customerName: newOrderData.customerName, 
      items: newOrderData.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        customizations: item.customizations,
      })),
      total: newOrderData.totalAmount,
      status: 'pending',
      timestamp: new Date().toLocaleString(), 
      ticketNumber: newTicketNumber,
    };

    setOrders(prevOrders => [...prevOrders, newOrder]);
    // Potentially: show a success notification, navigate, etc.
  };

  // Function to grant a voucher
  const grantVoucherToCustomer = (
    customerId: string,
    rewardId: string,
    grantedByEmployeeId: string,
    notes?: string
  ) => {
    const rewardDefinition = rewardsData.find(r => r.id === rewardId);
    if (!rewardDefinition) {
      alert(`Error: Reward definition with ID ${rewardId} not found.`);
      return;
    }

    const newVoucher: CustomerVoucher = {
      instanceId: uuidv4(),
      rewardId: rewardDefinition.id,
      name: rewardDefinition.name,
      description: rewardDefinition.description,
      grantedDate: new Date().toISOString(),
      status: 'active',
      grantedBy: 'employee_granted',
      customerId: customerId, // *** IMPORTANT: Added customerId to voucher ***
      employeeGrantDetails: {
        employeeId: grantedByEmployeeId,
        notes: notes,
      },
    };

    setAllCustomerVouchers(prev => [...prev, newVoucher]);
    alert(`Voucher "${rewardDefinition.name}" granted successfully to customer ID ${customerId}.`);
  };

  // Function to update a voucher's status (needed for claiming)
  const updateVoucherStatus = (voucherInstanceId: string, newStatus: 'claimed' | 'expired') => {
    setAllCustomerVouchers(prev =>
      prev.map(voucher =>
        voucher.instanceId === voucherInstanceId
          ? { ...voucher, status: newStatus }
          : voucher
      )
    );
  };

  // --- Function to mark a general reward as claimed by a customer ---
  const markGeneralRewardAsClaimed = (customerId: string, rewardId: string) => {
    setClaimedGeneralRewardsByCustomer(prev => {
      const customerClaims = prev[customerId] ? new Set(prev[customerId]) : new Set<string>();
      customerClaims.add(rewardId);
      return { ...prev, [customerId]: customerClaims };
    });
    // Consider adding an alert or log here if needed for debugging
    // console.log(`General reward ${rewardId} marked as claimed for customer ${customerId}`);
  };

  // --- Function to Deduct Points ---
  const deductPoints = (customerId: string, pointsToDeduct: number) => {
    setCustomerData(prevData => {
      const currentCustomer = prevData[customerId];
      if (currentCustomer && currentCustomer.points >= pointsToDeduct) {
        return {
          ...prevData,
          [customerId]: { ...currentCustomer, points: currentCustomer.points - pointsToDeduct }
        };
      } else {
        // Handle insufficient points - Use simple double quotes
        const message = "Attempted to deduct " + pointsToDeduct + " points from " + customerId + ", but they only have " + (currentCustomer?.points || 0) + ".";
        console.warn(message);
        alert("Error: Insufficient points.");
        return prevData;
      }
    });
  };

  const handleLogin = (username: string, password: string) => {
    const authenticatedUser = authenticateUser(username, password);
    if (authenticatedUser) {
      setUser(authenticatedUser);
      // If customer, one might fetch their specific vouchers here and add to user object or separate state
      setActivePage('Home');
    } else {
      alert('Invalid credentials');
    }
  };

  const handleLogout = () => {
      setUser(null);
      // Reset any other relevant state
  };

  if (!user) {
    return <LoginPage 
              onLogin={handleLogin} 
              rewardsData={rewardsData} 
              deductPoints={deductPoints} 
              generateReferralCode={generateReferralCode} 
            />;
  }

  const renderPage = () => {
    // Fallback for unauthorized access or unknown pages for a role
    const UnauthorizedOrHome = () => {
      alert("You do not have access to this page or it doesn\'t exist for your role. Returning to Home.");
      return <Home user={user} orders={orders} setActivePage={setActivePage} />; // Pass user, orders, and setActivePage
    }

    switch (activePage) {
      case 'Home':
        return <Home user={user} orders={orders} setActivePage={setActivePage} />;
      case 'Menu': // All roles seem to have Menu access from sidebar
        return <Menu placeNewOrder={placeNewOrder} user={user} />;
      case 'Rewards':
        if (['manager', 'employee', 'cashier', 'customer'].includes(user.role)) {
          // *** Determine the target Customer ID for the Rewards view ***
          // For demo, if staff, show a hardcoded customer ID. In reality, staff might search for a customer.
          // If customer, use their own ID.
          const targetCustomerIdForView = user.role === 'customer' ? user.id : 'juan@example.com'; // Default staff view to Juan
          const targetCustomerNameForView = user.role === 'customer' ? (user.name || 'Customer') : 'Juan Dela Cruz'; // Match the ID

          const customerSpecificVouchers = allCustomerVouchers.filter(
            v => v.customerId === targetCustomerIdForView && v.status !== 'expired'
          );
          
          // Get mutable data for the target customer
          const targetCustomerMutableData = customerData[targetCustomerIdForView] || { points: 0, purchasesThisMonth: 0 }; // Default if not found

          const customerInfoForRewards: CustomerInfo = {
              id: targetCustomerIdForView,
              name: targetCustomerNameForView,
              avatar: '/src/assets/person.svg', 
              loyaltyPoints: targetCustomerMutableData.points, // Use points from state
              purchasesThisMonth: targetCustomerMutableData.purchasesThisMonth, // Use purchases from state
              birthDate: `1990-${new Date().getMonth() + 1}-${new Date().getDate()}`, // Placeholder
              // ... other CustomerInfo fields (placeholders ok for now)
              activeVouchers: customerSpecificVouchers
            };
            
          return <Rewards
            rewardsData={rewardsData}
            customerInfo={customerInfoForRewards}
            user={user} 
            updateVoucherStatus={updateVoucherStatus}
            deductPoints={deductPoints} // Pass deductPoints function
            claimedGeneralRewards={claimedGeneralRewardsByCustomer[targetCustomerIdForView] || new Set<string>()} // Pass the specific customer\'s set
            markGeneralRewardAsClaimed={markGeneralRewardAsClaimed} // Pass the new function
                 />;
        }
        return <UnauthorizedOrHome />;
      case 'Profile': // All roles have Profile
        return <Profile user={user} />;
      case 'Settings': // All roles have Settings
        return <Settings />;
      case 'Logout':
        return <Logout onLogout={handleLogout} />;
      case 'Orders':
        if (['manager', 'employee', 'cook'].includes(user.role)) {
          return <Order orders={orders} updateOrderStatus={updateOrderStatus} />;
        }
        return <UnauthorizedOrHome />;
      case 'Edit Menu':
        if (user.role === 'manager') {
          return <EditMenu />;
        }
        return <UnauthorizedOrHome />;
      case 'Edit Rewards':
        if (user.role === 'manager') {
          return <EditRewards
                      rewardsData={rewardsData}
                      onAddReward={addReward}
                      onUpdateReward={updateReward}
                      onDeleteReward={deleteReward}
                      grantVoucherFunction={grantVoucherToCustomer}
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
        // If activePage is something not in any list, treat as unauthorized/go home
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

interface LoginFormData {
  email: string;
  password: string;
}

interface RegisterFormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  referralCode?: string;
}

interface ForgotPasswordFormData {
  email: string;
}

type AuthFormType = 'login' | 'register' | 'forgotPassword';

interface LoginPageProps {
  onLogin: (username: string, password: string) => void;
  rewardsData: RawRewardItem[];
  deductPoints: (customerId: string, pointsToDeduct: number) => void;
  generateReferralCode: (name: string) => string;
}

const LoginPage = ({ onLogin, rewardsData, deductPoints, generateReferralCode }: LoginPageProps) => {
  const [loginFormData, setLoginFormData] = useState<LoginFormData>({
    email: 'manager@business.org', // Default for convenience
    password: 'password'         // Default for convenience
  });
  const [registerFormData, setRegisterFormData] = useState<RegisterFormData>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    referralCode: ''
  });
  const [forgotPasswordFormData, setForgotPasswordFormData] = useState<ForgotPasswordFormData>({ email: '' });

  const [authFormType, setAuthFormType] = useState<AuthFormType>('login');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, formType: AuthFormType) => {
    const { name, value } = e.target;
    if (formType === 'login') {
      setLoginFormData(prev => ({ ...prev, [name]: value }));
    } else if (formType === 'register') {
      setRegisterFormData(prev => ({ ...prev, [name]: value }));
    } else if (formType === 'forgotPassword') {
      setForgotPasswordFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(loginFormData.email, loginFormData.password);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (registerFormData.password !== registerFormData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    let referralMessage = "No referral code provided or code was invalid.";
    const enteredReferralCode = registerFormData.referralCode?.trim().toUpperCase();

    if (enteredReferralCode) {
      // Find the referring user by their code
      // In a real app, usersData would be a database query or API call.
      // For demo, we iterate over the values of the `usersData` in `authenticateUser` scope,
      // but `authenticateUser` is not directly accessible here. 
      // So, we will have to redefine or pass usersData or a finder function.
      // For simplicity in this simulation, let's assume we can check against a conceptual list of users and their codes.
      // This part needs to be more robust in a real app.
      
      // Simulate finding a referring user
      let referringUser: User | null = null;
      let referringUserId: string | null = null;

      // To check codes, we need access to the user list with their generated/assigned codes.
      // Let's assume `usersData` from `authenticateUser` can be conceptually accessed or a similar check performed.
      // This is a simplification for the demo.
      const demoUserEntries = Object.entries({
        'manager@business.org': { role: 'manager', name: 'Fredrick (Manager)', referralCode: generateReferralCode('Fredrick (Manager)') },
        'employee@business.org': { role: 'employee', name: 'Employee Eve', referralCode: generateReferralCode('Employee Eve') },
        'cashier@business.org': { role: 'cashier', name: 'Cashier Carl', referralCode: generateReferralCode('Cashier Carl') },
        'cook@business.org': { role: 'cook', name: 'Cook Chris', referralCode: generateReferralCode('Cook Chris') },
        'customer@example.com': { role: 'customer', name: "Customer", referralCode: 'CUSTOABCDE' },
        'juan@example.com': { role: 'customer', name: 'Juan Dela Cruz', referralCode: 'JUANDFGHI' }
      });

      for (const [id, uData] of demoUserEntries) {
        if (uData.referralCode === enteredReferralCode) {
          referringUserId = id; // This would be the ID of the referring user
          // Construct a partial User object for the referrer for the alert
          referringUser = { id, role: uData.role as User['role'], name: uData.name, referralCode: uData.referralCode }; 
          break;
        }
      }

      if (referringUser && referringUserId) {
        referralMessage = `Valid referral code from ${referringUser.name}!\n`;
        
        // 1. Reward the referring user
        const referrerReward = rewardsData.find(r => r.criteria && r.criteria.isRewardForReferringUser);
        if (referrerReward) {
          // For now, assume it grants points. In a real app, check reward type/effects.
          // Simulate point grant by directly calling deductPoints with a negative value, or a new grantPoints function.
          // Let's assume 25 points as per reward def.
          deductPoints(referringUserId, -25); // Negative deduction = grant
          referralMessage += `${referringUser.name} gets ${referrerReward.name} (e.g., 25 points)!\n`;
        }

        // 2. Flag reward for the new user
        const newUserReward = rewardsData.find(r => r.criteria && r.criteria.isReferralBonusForNewUser);
        if (newUserReward) {
          // Points for the new user would be added upon actual account creation/first login.
          // For simulation, just mention it.
          referralMessage += `New user will receive ${newUserReward.name} (e.g., 50 points)!`;
        }
      } else {
        referralMessage = "Invalid referral code entered. Proceeding without referral bonus.";
      }
    }

    alert(
`Registration attempt: 
Full Name: ${registerFormData.fullName}
Email: ${registerFormData.email}
Referral Info: ${referralMessage}`
    );
    setAuthFormType('login');
  };

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Password reset request for: ${forgotPasswordFormData.email}`);
    setAuthFormType('login');
  };

  const pageTitles: Record<AuthFormType, string> = {
    login: 'Hi, Brewtista!',
    register: 'Glad to meet you!',
    forgotPassword: "Let\'s try that again!"
  }

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
            <h2 className="text-2xl font-medium text-brown-800">{pageTitles[authFormType]}</h2>
          </div>

          {/* Form container for swipe animation */}
          <div className="auth-form-container w-full relative overflow-hidden" style={{ height: 'auto' }}> {/* Adjust height as needed or make dynamic */}
            <div 
              className="flex transition-transform duration-300 ease-in-out"
              style={{ transform: authFormType === 'login' ? 'translateX(0%)' : authFormType === 'register' ? 'translateX(-100%)' : 'translateX(-200%)' }}
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
                      onChange={(e) => handleInputChange(e, 'login')}
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
                      onChange={(e) => handleInputChange(e, 'login')}
                placeholder="Password"
                className="w-full px-4 py-4 rounded-xl border border-gray-200 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                required
              />
            </div>
            <div className="flex items-center justify-end">
                    <button type="button" onClick={() => setAuthFormType('forgotPassword')} className="text-sm font-medium text-gray-500 hover:text-brown-600">
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
                    <button type="button" onClick={() => setAuthFormType('register')} className="font-medium text-blue-600 hover:text-blue-700 ml-1">
                Sign up now
                    </button>
                  </p>
                </form>
              </div>

              {/* Register Form Slide */}
              <div className="auth-form w-full flex-shrink-0 px-4"> {/* Added slight padding for spacing if needed */}
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div>
                    <input type="text" name="fullName" placeholder="Full Name" value={registerFormData.fullName} onChange={(e) => handleInputChange(e, 'register')} className="w-full px-4 py-4 rounded-xl border border-gray-200 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" required />
                  </div>
                  <div>
                    <input type="email" name="email" placeholder="Email" value={registerFormData.email} onChange={(e) => handleInputChange(e, 'register')} className="w-full px-4 py-4 rounded-xl border border-gray-200 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" required />
                  </div>
                  <div>
                    <input type="password" name="password" placeholder="Password" value={registerFormData.password} onChange={(e) => handleInputChange(e, 'register')} className="w-full px-4 py-4 rounded-xl border border-gray-200 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" required />
                  </div>
                  <div>
                    <input type="password" name="confirmPassword" placeholder="Confirm Password" value={registerFormData.confirmPassword} onChange={(e) => handleInputChange(e, 'register')} className="w-full px-4 py-4 rounded-xl border border-gray-200 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" required />
                  </div>
                  <div>
                    <input type="text" name="referralCode" placeholder="Referral Code (Optional)" value={registerFormData.referralCode} onChange={(e) => handleInputChange(e, 'register')} className="w-full px-4 py-4 rounded-xl border border-gray-200 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" />
                  </div>
                  <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors font-semibold">
                    Register
                  </button>
                  <p className="text-center text-sm text-gray-500">
                    Already have an account? 
                    <button type="button" onClick={() => setAuthFormType('login')} className="font-medium text-blue-600 hover:text-blue-700 ml-1">
                      Login
                    </button>
                  </p>
                </form>
              </div>

              {/* Forgot Password Form Slide */}
              <div className="auth-form w-full flex-shrink-0 px-4"> {/* Added slight padding */}
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-5">
                  <div>
                    <input type="email" name="email" placeholder="Enter your email" value={forgotPasswordFormData.email} onChange={(e) => handleInputChange(e, 'forgotPassword')} className="w-full px-4 py-4 rounded-xl border border-gray-200 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" required />
                  </div>
                  <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors font-semibold">
                    Send Reset Link
                  </button>
                  <p className="text-center text-sm text-gray-500">
                    Remembered your password? 
                    <button type="button" onClick={() => setAuthFormType('login')} className="font-medium text-blue-600 hover:text-blue-700 ml-1">
                      Back to Login
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
      { icon: 'rewards', label: 'Rewards' },
      { icon: 'employee', label: 'Employee' },
      { icon: 'profile', label: 'Profile' },
      { icon: 'settings', label: 'Settings' },
    ],
    cashier: [
      { icon: 'home', label: 'Home' },
      { icon: 'menu', label: 'Menu' },
      { icon: 'rewards', label: 'Rewards' },
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
