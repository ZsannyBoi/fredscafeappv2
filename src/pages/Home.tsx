import React, { useState, useEffect } from 'react';
import { OrderItem, User } from '../types'; // Import OrderItem and User type
import { toast } from 'react-toastify';

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
  setSelectedOrderId: (orderId: string | null) => void; // Add setSelectedOrderId prop
}

const Home: React.FC<HomePageProps> = ({ user, setActivePage, setSelectedOrderId }) => { // Destructure setActivePage and setSelectedOrderId
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
  const [userOrders, setUserOrders] = useState<OrderItem[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false);

  // State for order details modal
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState<boolean>(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);

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
        
        // Process stats locally based on orders data
        // Count orders by status and type
        let pendingOrders = ordersData.filter(o => o.status === 'pending').length;
        let preparingOrders = ordersData.filter(o => o.status === 'preparing').length;
        const completedOrders = ordersData.filter(o => o.status === 'completed').length;

        // Fetch customer info if user is a customer
        let customerInfo = null;
        if (isCustomer && user?.internalId) {
          try {
            const customerInfoResponse = await fetch(`http://localhost:3001/api/customers/${user.internalId}/info`, { headers });
            if (customerInfoResponse.ok) {
              customerInfo = await customerInfoResponse.json();
              console.log("Customer info fetched:", customerInfo);
            }
          } catch (infoErr) {
            console.error("Error fetching customer info:", infoErr);
          }
        }

        // Fetch user-specific orders if customer
        if (isCustomer && user?.internalId) {
          setIsLoadingOrders(true);
          try {
            const userOrdersResponse = await fetch(`http://localhost:3001/api/orders/customer/${user.internalId}?limit=10`, { headers });
            if (userOrdersResponse.ok) {
              const userOrdersData: OrderItem[] = await userOrdersResponse.json();
              setUserOrders(userOrdersData);
              
              // Use customer-specific order data for stats if available
              if (userOrdersData.length > 0) {
                pendingOrders = userOrdersData.filter(o => o.status === 'pending').length;
                preparingOrders = userOrdersData.filter(o => o.status === 'preparing').length;
              }
            }
          } catch (orderErr) {
            console.error("Error fetching user orders:", orderErr);
          } finally {
            setIsLoadingOrders(false);
          }
        }
        
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
          
        // Calculate employee stats based on the orders they processed
        let employeeOrdersProcessed = 0;
        let employeeEarnings = 0;
        
        if (user?.internalId && ['cashier', 'employee', 'cook'].includes(userRole || '')) {
          // Count orders that might be associated with this employee
          // This is approximate since we don't have a proper employee-order relationship
          employeeOrdersProcessed = completedOrders;
          
          // For cashiers, calculate total earnings they processed
          if (userRole === 'cashier') {
            employeeEarnings = totalRevenue;
          }
        }
          
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
            loyaltyPoints: customerInfo?.loyaltyPoints || 0,
            pendingRewards: customerInfo?.claimedGeneralRewardIds?.length || 0,
            activeVouchers: customerInfo?.activeVouchers?.length || 0,
          } : undefined,
          employeeStats: ['cashier', 'employee', 'cook'].includes(userRole || '') ? {
            ordersProcessed: employeeOrdersProcessed,
            todayEarnings: employeeEarnings,
          } : undefined
        });

      } catch (fetchError: any) {
        console.error("Error fetching home page data:", fetchError);
        setError(fetchError.message || "Failed to load dashboard data.");
        toast.error(`Failed to load dashboard data: ${fetchError.message || "Unknown error"}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    
    // Set up interval for real-time updates
    const intervalId = setInterval(fetchData, 30000); // Update every 30 seconds
    
    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [userRole, isCustomer, user?.internalId]); // Refetch if user role changes

  // --- Prepare data based on fetched state ---
  let preparingOrders = recentOrders.filter(order => order.status === 'preparing');
  let queuedOrders = recentOrders.filter(order => order.status === 'pending');

  if (isCustomer && user?.internalId) {
    // Use userOrders instead of recentOrders for customers
    if (userOrders.length > 0) {
      preparingOrders = userOrders.filter(order => order.status === 'preparing');
      queuedOrders = userOrders.filter(order => order.status === 'pending');
    } else {
      preparingOrders = preparingOrders.filter(order => order.customerId === user.internalId);
      queuedOrders = queuedOrders.filter(order => order.customerId === user.internalId);
    }
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
      content: <p className="text-3xl font-bold text-orange-500">
        {isCustomer ? queuedOrders.length : dashboardStats.pendingOrders}
      </p>,
      roles: ['manager', 'employee', 'cashier', 'cook', 'customer']
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
                    <div className="flex justify-end mt-1">
                      <button 
                        onClick={() => handleViewOrderDetails(order)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Details
                      </button>
                    </div>
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
              <ul className="space-y-2 max-h-28 overflow-y-auto pr-1">
                {queuedOrders.map(order => (
                  <li key={order.id} className="p-2 bg-gray-50 border border-gray-200 rounded-md text-xs">
                    <p className="font-semibold text-gray-900">{order.ticketNumber} - {order.customerName}</p>
                    <p className="text-gray-700">{order.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}</p>
                    <div className="flex justify-end mt-1">
                      <button 
                        onClick={() => handleViewOrderDetails(order)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Details
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">{isCustomer ? "You have no orders in the queue." : "No orders in the queue."}</p>
            )}
          </div>
          {!isCustomer && (
            <button 
              onClick={() => setActivePage('Orders')} 
              className="w-full mt-2 text-sm py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              Manage All Orders
            </button>
          )}
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
          <button 
            onClick={() => setActivePage('Orders')} 
            className="w-full mt-2 text-sm py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
          >
            View All Orders
          </button>
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
          {userRole === 'cook' && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Orders Preparing:</span>
              <span className="text-sm">{dashboardStats.preparingOrders}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm font-medium">Pending Orders:</span>
            <span className="text-sm">{dashboardStats.pendingOrders}</span>
          </div>
          <button 
            onClick={() => setActivePage('Orders')} 
            className="w-full mt-2 text-sm py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
          >
            View Orders
          </button>
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
          <div className="pt-2 mt-2 border-t border-stone-100 flex gap-2">
            <button 
              onClick={() => setActivePage('Rewards')} 
              className="flex-1 text-sm py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
            >
              View Rewards
            </button>
            <button 
              onClick={() => setActivePage('Menu')} 
              className="flex-1 text-sm py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              Redeem Now
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">No rewards data available</p>
      ),
      roles: ['customer']
    },
    {
      id: 10,
      title: "My Recent Orders",
      content: (
        <div className="space-y-3">
          {isLoadingOrders ? (
            <div className="animate-pulse space-y-3">
              <div className="h-14 bg-stone-100 rounded-md"></div>
              <div className="h-14 bg-stone-100 rounded-md"></div>
              <div className="h-14 bg-stone-100 rounded-md"></div>
            </div>
          ) : userOrders.length > 0 ? (
            <div className="max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-stone-200 scrollbar-track-white">
              {userOrders.map((order) => (
                <div key={order.id} className="mb-3 p-3 bg-white border rounded-lg shadow-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-800">#{order.ticketNumber}</span>
                      <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-medium ${
                        order.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                        order.status === 'preparing' ? 'bg-blue-100 text-blue-800' : 
                        order.status === 'ready' ? 'bg-purple-100 text-purple-800' : 
                        'bg-red-100 text-red-800'
                      }`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(order.timestamp).toLocaleDateString()} {new Date(order.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-1">
                    {order.items.slice(0, 2).map((item, idx) => (
                      <span key={idx}>
                        {idx > 0 && ', '}{item.quantity}x {item.name}
                      </span>
                    ))}
                    {order.items.length > 2 && `, +${order.items.length - 2} more`}
                  </div>
                  
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-stone-100">
                    <span className="text-sm font-medium text-gray-700">Total: ${order.total.toFixed(2)}</span>
                    <button 
                      onClick={() => {
                        handleViewOrderDetails(order);
                      }} 
                      className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <p className="text-gray-500">You haven't placed any orders yet.</p>
              <button 
                onClick={() => setActivePage('Menu')} 
                className="mt-3 text-sm font-medium text-emerald-600 hover:text-emerald-800"
              >
                Browse our menu
              </button>
            </div>
          )}
        </div>
      ),
      span: 'lg:col-span-2',
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
        return dashboardStats.employeeStats ? (
          <>
            <div className={statCardStyle}>
              <p className={statValueStyle}>{dashboardStats.employeeStats.ordersProcessed}</p>
              <p className={statLabelStyle}>Orders Processed</p>
            </div>
            <div className={statCardStyle}>
              <p className={statValueStyle}>${dashboardStats.employeeStats.todayEarnings.toFixed(0)}</p>
              <p className={statLabelStyle}>Sales Processed</p>
            </div>
          </>
        ) : null;
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
              <p className={statValueStyle}>{preparingOrders.length + queuedOrders.length}</p>
              <p className={statLabelStyle}>Active Orders</p>
            </div>
          </>
        ) : null;
      default:
        return null;
    }
  };

  // Function to show the order details modal
  const handleViewOrderDetails = (order: OrderItem) => {
    setSelectedOrder(order);
    setShowOrderDetailsModal(true);
    setSelectedOrderId(order.id); // Set the selected order ID in App.tsx state
    toast.info(`Viewing details for order #${order.ticketNumber || order.id}`);
  };

  // Function to close the order details modal
  const handleCloseOrderDetailsModal = () => {
    setShowOrderDetailsModal(false);
    setSelectedOrder(null);
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

      {/* Order Details Modal */}
      {showOrderDetailsModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Order #{selectedOrder.ticketNumber}</h2>
                <p className="text-gray-500 text-sm">{new Date(selectedOrder.timestamp).toLocaleString()}</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                selectedOrder.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 
                selectedOrder.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                selectedOrder.status === 'preparing' ? 'bg-blue-100 text-blue-800' : 
                selectedOrder.status === 'ready' ? 'bg-purple-100 text-purple-800' : 
                'bg-red-100 text-red-800'
              }`}>
                {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
              </div>
            </div>
            
            {/* Order Details */}
            <div className="p-6">
              {/* Order Items */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-700 mb-3">Order Items</h3>
                <div className="space-y-4">
                  {selectedOrder.items.map((item, index) => (
                    <div key={index} className="border-b border-gray-100 pb-3">
                      <div className="flex justify-between">
                        <span className="font-medium">{item.quantity}x {item.name}</span>
                      </div>
                      {item.customizations && item.customizations.length > 0 && (
                        <ul className="mt-1 text-sm text-gray-600">
                          {item.customizations.map((custom, idx) => (
                            <li key={idx}>
                              <span className="text-gray-500">{custom.group}:</span> {custom.option}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Order Total */}
              <div className="border-t border-gray-200 pt-4 mb-4">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total</span>
                  <span>${selectedOrder.total.toFixed(2)}</span>
                </div>
              </div>
              
              {/* Status Information */}
              <div className="mt-6">
                {['pending', 'preparing', 'ready'].includes(selectedOrder.status) ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
                    <p className="font-medium">Order Status: {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}</p>
                    <p className="mt-1">
                      {selectedOrder.status === 'pending' && "Your order has been received and is waiting to be prepared."}
                      {selectedOrder.status === 'preparing' && "Your order is currently being prepared."}
                      {selectedOrder.status === 'ready' && "Your order is ready for pickup!"}
                    </p>
                  </div>
                ) : null}
                
                {selectedOrder.status === 'completed' && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 text-sm text-emerald-800">
                    <p className="font-medium">Order Completed</p>
                    <p className="mt-1">Thank you for your order! We hope you enjoyed it.</p>
                  </div>
                )}
                
                {selectedOrder.status === 'cancelled' && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
                    <p className="font-medium">Order Cancelled</p>
                    <p className="mt-1">This order has been cancelled. If you have any questions, please contact our staff.</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="border-t border-gray-200 p-6 flex justify-between">
              <button 
                onClick={handleCloseOrderDetailsModal} 
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
              
              {selectedOrder.status === 'completed' && (
                <button 
                  onClick={() => {
                    // Open a print window with the receipt
                    const receiptWindow = window.open('', '_blank');
                    if (!receiptWindow) {
                      alert('Please allow pop-ups to print receipts');
                      return;
                    }
                    
                    const receiptContent = `
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <title>EspressoLane Receipt</title>
                          <style>
                            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; max-width: 400px; margin: 0 auto; }
                            .header { text-align: center; margin-bottom: 20px; }
                            .logo { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
                            .order-info { margin-bottom: 20px; border-bottom: 1px dashed #ccc; padding-bottom: 10px; }
                            .items { margin-bottom: 20px; }
                            .item { margin-bottom: 10px; }
                            .total { font-weight: bold; border-top: 1px solid #000; padding-top: 10px; text-align: right; }
                            .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #666; }
                          </style>
                        </head>
                        <body>
                          <div class="header">
                            <div class="logo">EspressoLane</div>
                            <div>Receipt</div>
                          </div>
                          <div class="order-info">
                            <p>Order #: ${selectedOrder.ticketNumber}</p>
                            <p>Date: ${new Date(selectedOrder.timestamp).toLocaleString()}</p>
                            <p>Customer: ${selectedOrder.customerName}</p>
                          </div>
                          <div class="items">
                            ${selectedOrder.items.map(item => `
                              <div class="item">
                                <div>${item.quantity}x ${item.name}</div>
                                ${item.customizations && item.customizations.length > 0 ? `
                                  <ul style="margin: 5px 0 0 20px; padding: 0; font-size: 14px; color: #666;">
                                    ${item.customizations.map(custom => `
                                      <li>${custom.group}: ${custom.option}</li>
                                    `).join('')}
                                  </ul>
                                ` : ''}
                              </div>
                            `).join('')}
                          </div>
                          <div class="total">
                            <p>Total: $${selectedOrder.total.toFixed(2)}</p>
                          </div>
                          <div class="footer">
                            <p>Thank you for your order!</p>
                          </div>
                        </body>
                      </html>
                    `;
                    
                    receiptWindow.document.open();
                    receiptWindow.document.write(receiptContent);
                    receiptWindow.document.close();
                    
                    // Trigger print dialog
                    setTimeout(() => {
                      receiptWindow.print();
                    }, 500);
                  }} 
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print Receipt
                </button>
              )}
            </div>
          </div>
        </div>
      )}
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