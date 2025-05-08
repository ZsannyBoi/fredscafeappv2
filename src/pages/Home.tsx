import React from 'react';
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
  orders: OrderItem[]; // CRITICAL SECURITY NOTE: This prop should ideally receive orders already filtered by the backend based on user role/ID.
                       // Passing all orders to the client and filtering here can expose sensitive data of other users to a logged-in customer.
  setActivePage: (page: string) => void; // Added setActivePage prop
}

const Home: React.FC<HomePageProps> = ({ user, orders, setActivePage }) => { // Destructure setActivePage
  const isCustomer = user?.role === 'customer';
  const userId = user?.id;
  const userRole = user?.role;

  let preparingOrders = orders.filter(order => order.status === 'preparing');
  let queuedOrders = orders.filter(order => order.status === 'pending');

  if (isCustomer && userId) {
    preparingOrders = preparingOrders.filter(order => order.customerId === userId);
    queuedOrders = queuedOrders.filter(order => order.customerId === userId);
  }

  const welcomeName = user?.name || userName;

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

  const allDashboardItems = [
    { 
      id: 1, title: "Revenue Today", 
      content: <p className="text-3xl font-bold text-emerald-600">${revenueToday.toFixed(2)}</p>,
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
          lowStockItems.length > 0 ? (
              <ul className="text-sm text-red-600 list-disc list-inside">
                 {lowStockItems.map(item => <li key={item}>{item}</li>)}
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
              {popularItemsData.map(item => <li key={item.name}><span className="font-medium text-gray-800">{item.name}:</span> {item.count} sold</li>)}
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

  // --- Helper to render specific statistics based on role ---
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
              <p className={statValueStyle}>{dailyStats.coffeeSold}</p>
              <p className={statLabelStyle}>Coffees sold</p>
            </div>
            <div className={statCardStyle}>
              <p className={statValueStyle}>{dailyStats.pastriesSold}</p>
              <p className={statLabelStyle}>Pastries sold</p>
            </div>
            <div className={statCardStyle}>
              <p className={statValueStyle}>{dailyStats.dessertsSold}</p>
              <p className={statLabelStyle}>Desserts sold</p>
            </div>
          </>
        );
      case 'cashier':
        return (
          <>
            <div className={statCardStyle}>
              <p className={statValueStyle}>{orders.length}</p> {/* Total orders as a proxy */}
              <p className={statLabelStyle}>Total Orders Today</p>
            </div>
            <div className={statCardStyle}>
              <p className={statValueStyle}>{orders.filter(o => o.status === 'completed').length}</p>
              <p className={statLabelStyle}>Completed Transactions</p>
            </div>
            <div className={statCardStyle}>
              <p className={statValueStyle}>2.5</p> {/* Placeholder */}
              <p className={statLabelStyle}>Avg. Items/Order</p>
            </div>
          </>
        );
      case 'cook':
        const itemsToPrep = orders
          .filter(o => o.status === 'pending' || o.status === 'preparing')
          .reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
        return (
          <>
            <div className={statCardStyle}>
              <p className={statValueStyle}>{orders.filter(o => o.status === 'pending' || o.status === 'preparing').length}</p>
              <p className={statLabelStyle}>Active Orders</p>
            </div>
            <div className={statCardStyle}>
              <p className={statValueStyle}>{itemsToPrep}</p>
              <p className={statLabelStyle}>Total Items to Prep</p>
            </div>
            <div className={statCardStyle}>
              <p className={statValueStyle}>Latte</p> {/* Placeholder */}
              <p className={statLabelStyle}>Busiest Item</p>
            </div>
          </>
        );
      default:
        return null; // No stats for other roles (e.g., general 'employee' or 'customer')
    }
  };

  return (
    <div className="flex gap-6">
      {/* Main Content Area */}
      <div className="flex-1">
        {/* Welcome Banner - Updated with dynamic heading and subtitle */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredDashboardItems.map(item => (
            <div key={item.id} className={`bg-white rounded-2xl p-5 shadow-sm border border-stone-200 ${item.span ? item.span : ''}`}> 
              <h3 className="text-lg font-semibold text-gray-800 mb-3">{item.title}</h3>
              {item.content}
            </div>
          ))}
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-72 flex flex-col gap-6">
        {/* User Profile Card */}
        {user && (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-stone-200">
            <img 
              src={user.role === 'manager' ? "/src/assets/manager-avatar.jpg" : "/src/assets/person.svg"} 
              alt="User Avatar" 
              className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-white shadow-md"
            />
            <h2 className="text-xl font-semibold">{user.name || 'User'}</h2>
            <p className="text-sm text-gray-500">{getDisplayRole(user.role)}</p>
          </div>
        )}

        {/* Daily Statistics Card - Updated to be conditional and use helper */}
        {(userRole === 'manager' || userRole === 'cashier' || userRole === 'cook') && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 flex-1">
            <h3 className="text-lg font-semibold text-gray-800 mb-5 text-center">
              {userRole === 'manager' ? 'Daily Overview' : 'Your Shift Stats'} {/* Dynamic Title */}
            </h3>
            <div className="space-y-5">
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