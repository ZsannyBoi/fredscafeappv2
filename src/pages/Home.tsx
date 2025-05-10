import React, { useState, useEffect } from 'react';
import { OrderItem, User } from '../types'; // Import OrderItem and User type

interface DashboardStats {
  coffeeSold: number;
  pastriesSold: number;
  dessertsSold: number;
}

interface RecentOrder {
  id: string;
  customerName: string;
  items: string[];
  total: number;
  status: 'pending' | 'completed' | 'cancelled';
}

interface PopularItem {
  name: string;
  quantity: number;
  trend: 'up' | 'down' | 'stable';
}

// Sample data - In a real app, this would come from state/props/API
const userName = "Fredrick";
const dailyStats = { coffeeSold: 27, pastriesSold: 11, dessertsSold: 5 };
const revenueToday = 245.75; // Placeholder
const lowStockItems = ["Vanilla Syrup", "Large Cups"]; // Placeholder
const popularItemsData = [ // Renamed to avoid conflict with PopularItem interface if it was meant for structure
    { name: "Hot Caramel Macchiato", count: 15 },
    { name: "Croissant", count: 8 },
];

interface HomePageProps {
  user: User | null;
  setActivePage: (page: string) => void; // Added setActivePage prop
}

const Home: React.FC<HomePageProps> = ({ user, setActivePage }) => { // Destructure setActivePage
  const isCustomer = user?.role === 'customer';
  const userId = user?.id;
  const userRole = user?.role;

  // --- State for fetched data ---
  const [recentOrders, setRecentOrders] = useState<OrderItem[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>({}); // Use 'any' or create specific type
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- Fetch Data Effect ---
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('authToken');
        const headers = { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };

        // Fetch recent orders (e.g., limit 5)
        const ordersResponse = await fetch('http://localhost:3001/api/orders?limit=5', { headers });
        if (!ordersResponse.ok) throw new Error(`Failed to fetch orders: ${ordersResponse.statusText}`);
        const ordersData: OrderItem[] = await ordersResponse.json();
        setRecentOrders(ordersData);

        // Fetch dashboard stats (requires a new backend endpoint, e.g., /api/dashboard/stats)
        // For now, we'll set placeholder stats. Replace with actual API call.
        // const statsResponse = await fetch('http://localhost:3001/api/dashboard/stats', { headers });
        // if (!statsResponse.ok) throw new Error(`Failed to fetch stats: ${statsResponse.statusText}`);
        // const statsData = await statsResponse.json();
        // setDashboardStats(statsData); 
        
        // --- Placeholder Stats (Replace with API call) --- 
        setDashboardStats({
          revenueToday: 245.75, // Example
          coffeeSold: 27,
          pastriesSold: 11,
          dessertsSold: 5,
          lowStockItems: ["Vanilla Syrup", "Large Cups"], // Example
          popularItems: [ // Example
            { name: "Hot Caramel Macchiato", count: 15 },
            { name: "Croissant", count: 8 },
          ]
        });
        // --- End Placeholder Stats --- 

      } catch (fetchError: any) {
        console.error("Error fetching home page data:", fetchError);
        setError(fetchError.message || "Failed to load dashboard data.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []); // Fetch on mount

  // --- Prepare data based on fetched state ---
  let preparingOrders = recentOrders.filter(order => order.status === 'preparing');
  let queuedOrders = recentOrders.filter(order => order.status === 'pending');

  if (isCustomer && userId) {
    // If customer, filter *fetched* recent orders for their ID
    preparingOrders = preparingOrders.filter(order => order.customerId === userId);
    queuedOrders = queuedOrders.filter(order => order.customerId === userId);
  }

  const welcomeName = user?.name || 'User'; // Use user.name

  // --- Dynamic Welcome Message (Heading & Subtitle) --- 
  const getWelcomeContent = () => {
    const name = welcomeName || 'there'; // Fallback name
    let content = {
      heading: `Brew-tiful day, ${name}!`, // Generic fallback heading
      subtitle: "Your daily dashboard overview." // Generic fallback subtitle
    };

    switch (userRole) {
      case 'manager': 
        content.heading = `Welcome back, ${name}! Ready to manage?`;
        content.subtitle = "Here's an overview of today's performance.";
        break;
      case 'cashier': 
        content.heading = `Ready for customers, ${name}?`;
        content.subtitle = "Keep those orders coming smoothly!";
        break;
      case 'cook': 
        content.heading = `Let's get cooking, ${name}!`;
        content.subtitle = "Here are the orders needing your attention.";
        break;
      case 'employee': 
        content.heading = `Welcome, ${name}! How can you help today?`;
        content.subtitle = "Check the dashboard for current tasks and orders.";
        break;
      case 'customer': 
        content.heading = `Good to see you, ${name}!`;
        content.subtitle = "Check out your points, rewards, and recent orders.";
        break;
    }
    return content;
  };

  const welcomeContent = getWelcomeContent(); // Get the content object

  // --- Build Dashboard Items using fetched state --- 
  const allDashboardItems = [
    { 
      id: 1, title: "Revenue Today", 
      content: <p className="text-3xl font-bold text-emerald-600">${(dashboardStats.revenueToday || 0).toFixed(2)}</p>,
      roles: ['manager']
    },
    {
      id: 2, title: isCustomer ? "My Pending Orders" : "Orders Pending",
      content: <p className="text-3xl font-bold text-orange-500">{queuedOrders.length}</p>,
      roles: ['manager', 'employee', 'cashier', 'cook', 'customer']
    },
    {
      id: 3, title: "Low Stock Items", 
      content: (
          (dashboardStats.lowStockItems?.length ?? 0) > 0 ? (
              <ul className="text-sm text-red-600 list-disc list-inside">
                 {dashboardStats.lowStockItems.map((item: string) => <li key={item}>{item}</li>)}
              </ul>
          ) : (
              <p className="text-sm text-gray-500">All stock levels OK.</p>
          )
      ),
      roles: ['manager', 'employee', 'cashier', 'cook'] 
    },
    {
      id: 4, title: "Popular Items", 
      content: (
          <ul className="text-sm text-gray-700 space-y-1">
              {(dashboardStats.popularItems || []).map((item: any) => <li key={item.name}><span className="font-medium text-gray-800">{item.name}:</span> {item.count} sold</li>)}
          </ul>
      ),
      roles: ['manager', 'employee', 'cashier', 'cook', 'customer']
    },
    { 
      id: 5, title: "Quick Actions", 
      content: (() => {
        const managerActions = (
          <>
            <button onClick={() => setActivePage('Menu')} className="quick-action-button">Start New Order</button>
            <button onClick={() => setActivePage('Reports')} className="quick-action-button">View Reports</button> {/* Reports page doesn't exist yet */} 
            <button onClick={() => setActivePage('Employee')} className="quick-action-button">Manage Users</button>
          </>
        );
        const staffActions = (
          <>
            <button onClick={() => setActivePage('Menu')} className="quick-action-button">Start New Order</button>
            <button onClick={() => setActivePage('Menu')} className="quick-action-button">View Full Menu</button>
          </>
        );
        const cookActions = (
          <>
            <button onClick={() => setActivePage('Orders')} className="quick-action-button">View Active Orders</button>
            <button onClick={() => setActivePage('Menu')} className="quick-action-button">View Full Menu</button>
          </>
        );

        switch (userRole) {
          case 'manager':
            return <div className="flex flex-wrap gap-2">{managerActions}</div>;
          case 'cashier':
          case 'employee':
            return <div className="flex flex-wrap gap-2">{staffActions}</div>;
          case 'cook':
            return <div className="flex flex-wrap gap-2">{cookActions}</div>;
          default:
            return null;
        }
      })(), 
      span: 'lg:col-span-2',
      roles: ['manager', 'employee', 'cashier', 'cook']
    },
    {
      id: 6, 
      title: isCustomer ? "My Order Status" : "Order Queue & Status",
      content: (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-yellow-800 mb-1">
              {isCustomer ? "Being Prepared For You" : "Currently Preparing"}: {preparingOrders.length}
            </p>
            {preparingOrders.length > 0 ? (
              <ul className="space-y-2 max-h-28 overflow-y-auto pr-1">
                {preparingOrders.map(order => (
                  <li key={order.id} className="p-2 bg-yellow-50 border border-yellow-200 rounded-md text-xs">
                    <p className="font-semibold text-yellow-900">{order.ticketNumber} - {order.customerName}</p>
                    <p className="text-yellow-700">{order.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">{isCustomer ? "None of your orders are currently being prepared." : "No orders currently being prepared."}</p>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-stone-200">
            <p className="text-sm font-medium text-gray-700">
              {isCustomer ? "Your Queued Orders" : "Queued Orders"}: {queuedOrders.length}
            </p>
            {queuedOrders.length > 0 ? (
              <ul className="text-xs text-gray-600 list-disc list-inside pl-1 max-h-20 overflow-y-auto">
                {queuedOrders.map(order => (
                  <li key={order.id}>{order.ticketNumber} - {order.customerName}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">{isCustomer ? "You have no orders in the queue." : "No orders in the queue."}</p>
            )}
          </div>
        </div>
      ),
      span: 'lg:col-span-2',
      roles: ['manager', 'employee', 'cashier', 'cook', 'customer']
    },
  ];

  let filteredDashboardItems = allDashboardItems.filter(item => 
    userRole && item.roles.includes(userRole)
  );

  const getDisplayRole = (role: string | undefined) => {
    if (!role) return 'Guest';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  if (userRole === 'customer') {
    filteredDashboardItems.push({
      id: 7, 
      title: "My Rewards Hub",
      content: (
        <div className="flex justify-center items-center h-full">
          <button 
            className="px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors font-semibold text-sm shadow-md"
            onClick={() => setActivePage('Rewards')}
          >
            View My Rewards & Vouchers
          </button>
        </div>
      ),
      roles: ['customer'] 
    });
  }

  // --- Helper to render specific statistics based on role (using fetched stats) ---
  const renderRoleSpecificStats = () => {
    if (!userRole) return null;
    const statCardStyle = "text-center bg-stone-50 p-4 rounded-xl border border-stone-200";
    const statValueStyle = "text-3xl font-bold text-emerald-600";
    const statLabelStyle = "text-xs text-gray-500";
    switch (userRole) {
      case 'manager':
        return (
          <>
            <div className={statCardStyle}>
              <p className={statValueStyle}>{dashboardStats.coffeeSold || 0}</p>
              <p className={statLabelStyle}>Coffees sold</p>
            </div>
            <div className={statCardStyle}>
              <p className={statValueStyle}>{dashboardStats.pastriesSold || 0}</p>
              <p className="text-xs text-gray-500">Pastries sold</p>
            </div>
             <div className={statCardStyle}>
              <p className={statValueStyle}>{dashboardStats.dessertsSold || 0}</p>
              <p className="text-xs text-gray-500">Desserts sold</p>
            </div>
          </>
        );
      case 'cashier':
      case 'employee':
        // Example: Show orders taken/processed by this user? Requires different stats.
        return <p className="text-sm text-gray-600 col-span-full">Employee stats placeholder.</p>;
      case 'cook':
        return (
          <>
            <div className={statCardStyle}>
              <p className={statValueStyle}>{preparingOrders.length}</p>
              <p className={statLabelStyle}>Orders Preparing</p>
            </div>
             <div className={statCardStyle}>
              <p className={statValueStyle}>{queuedOrders.length}</p>
              <p className={statLabelStyle}>Orders Queued</p>
            </div>
          </>
        );
      case 'customer':
        // Example: Fetch customer points here if not passed via user prop
        return <p className="text-sm text-gray-600 col-span-full">Customer stats placeholder.</p>;
      default:
        return null;
    }
  };

  // --- Main Render (Restoring banner and sidebar structure) ---
  if (isLoading) {
    return <div className="p-6">Loading Dashboard...</div>;
  }
  if (error) {
    return <div className="p-6 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="flex gap-6 h-full"> 
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Welcome Banner - Restored */}
        <div className="relative rounded-2xl p-8 mb-8 text-white shadow-lg overflow-hidden bg-cover bg-center" 
             style={{ backgroundImage: `url('/src/assets/banner.jpg')` }}>
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30 z-0"></div>
            <div className="relative z-10 flex justify-between items-end">
                 <div>
                    <h1 className="text-3xl font-bold mb-2 text-stone-50">{welcomeContent.heading}</h1>
                    <p className="text-gray-200 max-w-md">{welcomeContent.subtitle}</p>
                 </div>
              </div>
         </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 flex-1 overflow-y-auto pr-2"> {/* Adjusted grid cols? */} 
          {filteredDashboardItems.map(item => (
            <div key={item.id} className={`bg-white rounded-2xl p-5 shadow-sm border border-stone-200 ${item.span || ''}`}>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">{item.title}</h3>
              {item.content}
            </div>
          ))}
        </div>
      </div>

      {/* Right Sidebar (Restored) */}
      <div className="w-72 flex flex-col gap-6 flex-shrink-0"> 
        {/* User Profile Card */}
        {user && (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-stone-200">
            <img 
              src={user.avatar || "/src/assets/avatar.png"}
              alt="User Avatar" 
              className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-white shadow-md"
            />
            <h2 className="text-xl font-semibold">{user.name || 'User'}</h2>
            <p className="text-sm text-gray-500">{getDisplayRole(user.role)}</p>
          </div>
        )}

        {/* Daily Statistics Card */}
        {(userRole === 'manager' || userRole === 'cashier' || userRole === 'cook') && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 flex-1">
            <h3 className="text-lg font-semibold text-gray-800 mb-5 text-center">
              {userRole === 'manager' ? 'Daily Overview' : 'Your Shift Stats'}
            </h3>
            {/* Use grid or space-y depending on desired layout within stats card */}
            <div className="grid grid-cols-2 gap-4"> 
              {renderRoleSpecificStats()} 
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Add this style to index.css or use Tailwind classes directly
/*
.quick-action-button {
    @apply px-3 py-1.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-200 transition-colors;
}
*/

export default Home; 