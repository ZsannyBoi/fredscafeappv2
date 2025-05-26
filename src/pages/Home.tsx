import React, { useState, useEffect } from 'react';
import { OrderItem, User } from '../types'; // Import OrderItem and User type

interface DashboardStats {
  coffeeSold: number;
  pastriesSold: number;
  dessertsSold: number;
  revenueToday: number;
  lowStockItems: string[];
  popularItems: { name: string; count: number }[];
  pendingOrders: number;
  preparingOrders: number;
  completedOrdersToday: number;
  customerStats?: {
    loyaltyPoints: number;
    pendingRewards: number;
    activeVouchers: number;
  };
  employeeStats?: {
    ordersProcessed: number;
    todayEarnings: number;
  };
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
  const userRole = user?.role;

  // --- State for fetched data ---
  const [recentOrders, setRecentOrders] = useState<OrderItem[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    coffeeSold: 0,
    pastriesSold: 0,
    dessertsSold: 0,
    revenueToday: 0,
    lowStockItems: [],
    popularItems: [],
    pendingOrders: 0,
    preparingOrders: 0,
    completedOrdersToday: 0
  });
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

        // Fetch recent orders with limit
        const ordersResponse = await fetch('http://localhost:3001/api/orders?limit=5', { headers });
        if (!ordersResponse.ok) throw new Error(`Failed to fetch orders: ${ordersResponse.statusText}`);
        const ordersData: OrderItem[] = await ordersResponse.json();
        setRecentOrders(ordersData);

        // Process stats locally instead of fetching from non-existent endpoint
        // Count orders by status and type
        const pendingOrders = ordersData.filter(o => o.status === 'pending').length;
        const preparingOrders = ordersData.filter(o => o.status === 'preparing').length;
        const completedOrders = ordersData.filter(o => o.status === 'completed').length;
        
        // Calculate statistics based on order data
        const totalRevenue = ordersData.reduce((sum, order) => sum + order.total, 0);
        
        // Count product categories in orders
        let coffeeSold = 0;
        let pastriesSold = 0;
        let dessertsSold = 0;
        
        // Count items by categories
        ordersData.forEach(order => {
          order.items.forEach(item => {
            const lowerName = item.name.toLowerCase();
            if (lowerName.includes('coffee') || lowerName.includes('latte') || 
                lowerName.includes('espresso') || lowerName.includes('cappuccino')) {
              coffeeSold += item.quantity;
            } else if (lowerName.includes('pastry') || lowerName.includes('croissant') || 
                       lowerName.includes('muffin') || lowerName.includes('bagel')) {
              pastriesSold += item.quantity;
            } else if (lowerName.includes('cake') || lowerName.includes('cookie') || 
                       lowerName.includes('dessert') || lowerName.includes('pie')) {
              dessertsSold += item.quantity;
            }
          });
        });
        
        // Determine popular items
        const itemCounts: Record<string, number> = {};
        ordersData.forEach(order => {
          order.items.forEach(item => {
            const name = item.name;
            itemCounts[name] = (itemCounts[name] || 0) + item.quantity;
          });
        });
        
        const popularItems = Object.entries(itemCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);
          
        // Set dashboard stats with calculated data
        setDashboardStats({
          coffeeSold,
          pastriesSold,
          dessertsSold,
          revenueToday: totalRevenue,
          lowStockItems: [], // No way to determine this from order data
          popularItems,
          pendingOrders,
          preparingOrders,
          completedOrdersToday: completedOrders,
          customerStats: userRole === 'customer' ? {
            loyaltyPoints: 0, // Placeholder - would need specific API
            pendingRewards: 0,
            activeVouchers: 0,
          } : undefined,
          employeeStats: ['cashier', 'employee', 'cook'].includes(userRole || '') ? {
            ordersProcessed: 0, // Placeholder - would need specific API
            todayEarnings: 0,
          } : undefined
        });

      } catch (fetchError: any) {
        console.error("Error fetching home page data:", fetchError);
        setError(fetchError.message || "Failed to load dashboard data.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    
    // Set up interval for real-time updates
    const intervalId = setInterval(fetchData, 30000); // Update every 30 seconds
    
    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [userRole]); // Refetch if user role changes

  // --- Prepare data based on fetched state ---
  let preparingOrders = recentOrders.filter(order => order.status === 'preparing');
  let queuedOrders = recentOrders.filter(order => order.status === 'pending');

  if (isCustomer && user?.internalId) {
    preparingOrders = preparingOrders.filter(order => order.customerId === user.internalId);
    queuedOrders = queuedOrders.filter(order => order.customerId === user.internalId);
  }

  const welcomeName = user?.name || 'User'; // Use user.name

  // --- Dynamic Welcome Message (Heading & Subtitle) --- 
  const getWelcomeContent = () => {
    const name = welcomeName || 'there'; // Fallback name
    const currentHour = new Date().getHours();
    let greeting = "Welcome";
    
    if (currentHour < 12) greeting = "Good morning";
    else if (currentHour < 18) greeting = "Good afternoon";
    else greeting = "Good evening";
    
    let content = {
      heading: `${greeting}, ${name}!`,
      subtitle: "Your daily dashboard overview."
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
      id: 1, title: "Today's Revenue", 
      content: <p className="text-3xl font-bold text-emerald-600">${dashboardStats.revenueToday.toFixed(2)}</p>,
      roles: ['manager']
    },
    {
      id: 2, title: isCustomer ? "My Pending Orders" : "Orders Pending",
      content: <p className="text-3xl font-bold text-orange-500">{dashboardStats.pendingOrders}</p>,
      roles: ['manager', 'employee', 'cashier', 'cook', 'customer']
    },
    {
      id: 3, title: "Low Stock Items", 
      content: (
          dashboardStats.lowStockItems.length > 0 ? (
              <ul className="text-sm text-red-600 list-disc list-inside">
                 {dashboardStats.lowStockItems.map((item: string) => <li key={item}>{item}</li>)}
              </ul>
          ) : (
              <p className="text-sm text-gray-500">All stock levels OK.</p>
          )
      ),
      roles: ['manager', 'employee'] 
    },
    {
      id: 4, title: "Popular Items", 
      content: (
          <ul className="text-sm text-gray-700 space-y-1">
              {dashboardStats.popularItems.map((item) => (
                <li key={item.name}>
                  <span className="font-medium text-gray-800">{item.name}:</span> {item.count} sold
                </li>
              ))}
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
            <button onClick={() => setActivePage('Orders')} className="quick-action-button">Manage Orders</button>
            <button onClick={() => setActivePage('Employee')} className="quick-action-button">Manage Staff</button>
            <button onClick={() => setActivePage('EditMenu')} className="quick-action-button">Edit Menu</button>
          </>
        );
        const cashierActions = (
          <>
            <button onClick={() => setActivePage('Menu')} className="quick-action-button">Start New Order</button>
            <button onClick={() => setActivePage('Orders')} className="quick-action-button">Manage Orders</button>
            <button onClick={() => setActivePage('Rewards')} className="quick-action-button">Customer Rewards</button>
          </>
        );
        const employeeActions = (
          <>
            <button onClick={() => setActivePage('Menu')} className="quick-action-button">Start New Order</button>
            <button onClick={() => setActivePage('Orders')} className="quick-action-button">View Orders</button>
          </>
        );
        const cookActions = (
          <>
            <button onClick={() => setActivePage('Orders')} className="quick-action-button">Manage Orders</button>
            <button onClick={() => setActivePage('Menu')} className="quick-action-button">View Menu</button>
          </>
        );
        const customerActions = (
          <>
            <button onClick={() => setActivePage('Menu')} className="quick-action-button">Order Now</button>
            <button onClick={() => setActivePage('Rewards')} className="quick-action-button">My Rewards</button>
          </>
        );

        switch (userRole) {
          case 'manager':
            return <div className="flex flex-wrap gap-2">{managerActions}</div>;
          case 'cashier':
            return <div className="flex flex-wrap gap-2">{cashierActions}</div>;
          case 'employee':
            return <div className="flex flex-wrap gap-2">{employeeActions}</div>;
          case 'cook':
            return <div className="flex flex-wrap gap-2">{cookActions}</div>;
          case 'customer':
            return <div className="flex flex-wrap gap-2">{customerActions}</div>;
          default:
            return null;
        }
      })(), 
      span: 'lg:col-span-2',
      roles: ['manager', 'employee', 'cashier', 'cook', 'customer']
    },
    {
      id: 6, 
      title: isCustomer ? "My Order Status" : "Order Queue Status",
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
    {
      id: 7,
      title: "Daily Sales Breakdown",
      content: (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Coffee Items:</span>
            <span className="text-sm">{dashboardStats.coffeeSold} sold</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Pastry Items:</span>
            <span className="text-sm">{dashboardStats.pastriesSold} sold</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Dessert Items:</span>
            <span className="text-sm">{dashboardStats.dessertsSold} sold</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm font-medium">Completed Orders:</span>
            <span className="text-sm">{dashboardStats.completedOrdersToday} today</span>
          </div>
        </div>
      ),
      roles: ['manager']
    },
    {
      id: 8,
      title: "My Performance",
      content: dashboardStats.employeeStats ? (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Orders Processed:</span>
            <span className="text-sm">{dashboardStats.employeeStats.ordersProcessed} today</span>
          </div>
          {userRole === 'cashier' && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Sales Processed:</span>
              <span className="text-sm">${dashboardStats.employeeStats.todayEarnings.toFixed(2)}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No performance data available</p>
      ),
      roles: ['cashier', 'employee', 'cook']
    },
    {
      id: 9,
      title: "My Rewards",
      content: dashboardStats.customerStats ? (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Loyalty Points:</span>
            <span className="text-sm font-semibold text-emerald-600">{dashboardStats.customerStats.loyaltyPoints} pts</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Pending Rewards:</span>
            <span className="text-sm">{dashboardStats.customerStats.pendingRewards}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Active Vouchers:</span>
            <span className="text-sm">{dashboardStats.customerStats.activeVouchers}</span>
          </div>
          <button 
            onClick={() => setActivePage('Rewards')} 
            className="w-full mt-2 text-sm py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
          >
            View My Rewards
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-500">No rewards data available</p>
      ),
      roles: ['customer']
    }
  ];

  let filteredDashboardItems = allDashboardItems.filter(item => 
    userRole && item.roles.includes(userRole)
  );

  const getDisplayRole = (role: string | undefined) => {
    if (!role) return 'Guest';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

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
              <p className={statValueStyle}>${dashboardStats.revenueToday.toFixed(0)}</p>
              <p className={statLabelStyle}>Today's Sales</p>
            </div>
            <div className={statCardStyle}>
              <p className={statValueStyle}>{dashboardStats.completedOrdersToday}</p>
              <p className={statLabelStyle}>Orders Today</p>
            </div>
          </>
        );
      case 'cashier':
      case 'employee':
        return dashboardStats.employeeStats ? (
          <>
            <div className={statCardStyle}>
              <p className={statValueStyle}>{dashboardStats.employeeStats.ordersProcessed}</p>
              <p className={statLabelStyle}>Orders Processed</p>
            </div>
            <div className={statCardStyle}>
              <p className={statValueStyle}>{dashboardStats.pendingOrders + dashboardStats.preparingOrders}</p>
              <p className={statLabelStyle}>Active Orders</p>
            </div>
          </>
        ) : null;
      case 'cook':
        return (
          <>
            <div className={statCardStyle}>
              <p className={statValueStyle}>{dashboardStats.preparingOrders}</p>
              <p className={statLabelStyle}>Orders Preparing</p>
            </div>
            <div className={statCardStyle}>
              <p className={statValueStyle}>{dashboardStats.pendingOrders}</p>
              <p className={statLabelStyle}>Orders Queued</p>
            </div>
          </>
        );
      case 'customer':
        return dashboardStats.customerStats ? (
          <>
            <div className={statCardStyle}>
              <p className={statValueStyle}>{dashboardStats.customerStats.loyaltyPoints}</p>
              <p className={statLabelStyle}>Loyalty Points</p>
            </div>
            <div className={statCardStyle}>
              <p className={statValueStyle}>{dashboardStats.customerStats.activeVouchers}</p>
              <p className={statLabelStyle}>Active Vouchers</p>
            </div>
          </>
        ) : null;
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
            {userRole === 'customer' && dashboardStats.customerStats && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-sm font-semibold text-emerald-600">
                  {dashboardStats.customerStats.loyaltyPoints} Points
                </p>
              </div>
            )}
          </div>
        )}

        {/* Daily Statistics Card */}
        {(userRole === 'manager' || userRole === 'cashier' || userRole === 'cook' || userRole === 'employee') && (
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