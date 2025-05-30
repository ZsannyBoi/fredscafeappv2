import React, { useState, useEffect, useCallback } from 'react';
import { OrderItem, User } from '../types'; // Import OrderItem and User
import { toast } from 'react-toastify';

// Define props for the Order component
interface OrderPageProps {
  user: User | null; // Add user prop definition
  selectedOrderId: string | null; // Add selectedOrderId prop
  setSelectedOrderId: (orderId: string | null) => void; // Add setSelectedOrderId prop
}

const Order: React.FC<OrderPageProps> = ({ user, selectedOrderId, setSelectedOrderId }) => { // Accept props
  const [localOrders, setLocalOrders] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const userRole = user?.role; // Correctly initialize userRole

  // --- Moved fetchOrders outside useEffect and wrapped in useCallback ---
  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('authToken'); 
      const response = await fetch('http://localhost:3001/api/orders', {
         headers: {
           ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
         },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: OrderItem[] = await response.json();
      setLocalOrders(data);
    } catch (fetchError: any) {
      console.error("Failed to fetch orders:", fetchError);
      setError(`Failed to load orders: ${fetchError.message}`);
      toast.error(`Failed to load orders: ${fetchError.message}`);
      setLocalOrders([]);
    } finally {
      setIsLoading(false);
    }
    // Add state setters to dependency array
  }, [setIsLoading, setError, setLocalOrders]);

  // Debounce search input
  useEffect(() => {
    const timerId = setTimeout(() => {
      setSearchQuery(inputValue);
      // Optionally trigger a re-fetch here if filtering is done backend-side
      // fetchOrders(inputValue);
    }, 500);
    return () => clearTimeout(timerId);
  }, [inputValue]);

  // Fetch Orders on Mount - Now calls the memoized fetchOrders
  useEffect(() => {
    fetchOrders();
    // Auto-refresh orders every 30 seconds
    const intervalId = setInterval(() => {
      fetchOrders();
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, [fetchOrders]);

  // Effect to clear selectedOrderId when component unmounts
  useEffect(() => {
    return () => {
      // Clear the selected order ID when the component unmounts
      setSelectedOrderId(null);
    };
  }, [setSelectedOrderId]);

  // Client-side filtering (update to use localOrders)
  // Consider backend filtering for better performance
  const filteredOrders = localOrders
    .filter(order =>
      // If selectedOrderId is not null, only show that specific order
      (selectedOrderId ? order.id === selectedOrderId : true) &&
      (searchQuery ? 
        order.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase())
        : true) &&
      // Filter by active/completed tab
      (activeTab === 'active' 
        ? !['completed', 'cancelled'].includes(order.status)
        : ['completed', 'cancelled'].includes(order.status))
    )
    // Sort by status priority and then by creation time (newest first)
    .sort((a, b) => {
      // Define status priority (higher number = higher priority)
      const statusPriority: Record<string, number> = {
        'ready': 4,
        'preparing': 3,
        'pending': 2,
        'completed': 1,
        'cancelled': 0
      };
      
      // First sort by status priority
      const priorityDiff = (statusPriority[b.status] || 0) - (statusPriority[a.status] || 0);
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by createdAt if available, assuming newer orders should be shown first
      // This assumes there's a createdAt field, if not, we can use the order ID or another field
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      
      return 0;
    });

  // --- New function to handle status updates via API ---
  const handleUpdateStatus = async (orderId: string, newStatus: OrderItem['status']) => {
    // Find the order to potentially update optimistically
    const originalOrder = localOrders.find(o => o.id === orderId);
    if (!originalOrder) return;

    // Optimistic UI Update (optional but improves perceived performance)
    setLocalOrders(prevOrders =>
      prevOrders.map(order =>
        order.id === orderId ? { ...order, status: newStatus } : order
      )
    );

    try {
      // TODO: Replace with actual API call including JWT
      const token = localStorage.getItem('authToken'); // Placeholder
      const response = await fetch(`http://localhost:3001/api/orders/${orderId}/status`, { // Example endpoint
        method: 'PATCH', // Or PUT
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        // Revert optimistic update on failure
        setLocalOrders(prevOrders =>
           prevOrders.map(order =>
             order.id === orderId ? originalOrder : order // Restore original order
           )
        );
        const errorData = await response.json().catch(() => ({ message: 'Server error updating status.'}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      console.log(`Successfully updated order ${orderId} to status ${newStatus}`);
      toast.success(`Order ${orderId} status updated to ${newStatus}`);

    } catch (updateError: any) {
      console.error(`Failed to update order ${orderId} status:`, updateError);
      // Revert optimistic update if not already done
       setLocalOrders(prevOrders =>
           prevOrders.map(order =>
             order.id === orderId ? originalOrder : order
           )
        );
      toast.error(`Error updating order status: ${updateError.message}`);
    }
  };

  // --- Function to handle archiving an order ---
  const handleArchiveOrder = async (orderId: string) => {
    if (!user || (user.role !== 'manager' && user.role !== 'cashier')) {
      toast.error('Permission denied.'); // Should not happen if button is hidden, but good practice
      return;
    }
    if (!window.confirm(`Are you sure you want to archive order ${orderId}? It will be hidden from this view.`)) {
      return;
    }

    // Optimistic UI Update: Remove the order immediately
    setLocalOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`http://localhost:3001/api/orders/${orderId}/archive`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        // No body needed for this simple archive action
      });

      if (!response.ok) {
        // Revert optimistic update on failure
        // Fetching orders again is simpler than trying to re-insert the removed one
        fetchOrders(); // Refetch to get the original state back
        const errorData = await response.json().catch(() => ({ message: 'Server error archiving order.'}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      console.log(`Successfully archived order ${orderId}`);
      toast.success(`Order ${orderId} archived successfully`);
      // No need to refetch on success, optimistic update handles it.

    } catch (archiveError: any) {
      console.error(`Failed to archive order ${orderId}:`, archiveError);
      // Ensure state is reverted if not already done
      fetchOrders(); // Refetch to be sure
      toast.error(`Error archiving order: ${archiveError.message}`);
    }
  };

  // Format relative time
  const formatRelativeTime = (timestamp: string) => {
    if (!timestamp) return '';
    
    const now = new Date();
    const orderTime = new Date(timestamp);
    const diffMinutes = Math.floor((now.getTime() - orderTime.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes === 1) return '1 min ago';
    if (diffMinutes < 60) return `${diffMinutes} mins ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  // --- Render Logic ---
  // Handle loading state
  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brown-500 mx-auto mb-4"></div>
          <p className="text-lg text-brown-800">Loading orders...</p>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 inline-block">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-red-800 text-lg font-medium">Error: {error}</p>
          <button 
            onClick={() => fetchOrders()} 
            className="mt-4 px-4 py-2 bg-brown-500 text-white rounded-lg hover:bg-brown-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Main Render
  return (
    <div className="text-brown-800 p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold">Orders</h1>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Tab Navigation */}
          <div className="flex rounded-lg overflow-hidden border border-gray-300">
            <button 
              className={`px-4 py-2 font-medium ${activeTab === 'active' 
                ? 'bg-brown-500 text-white' 
                : 'bg-white text-brown-800 hover:bg-gray-100'}`}
              onClick={() => setActiveTab('active')}
            >
              Active Orders
            </button>
            <button 
              className={`px-4 py-2 font-medium ${activeTab === 'completed' 
                ? 'bg-brown-500 text-white' 
                : 'bg-white text-brown-800 hover:bg-gray-100'}`}
              onClick={() => setActiveTab('completed')}
            >
              Completed
            </button>
          </div>
          
          {/* Search Input with Icon */}
          <div className="relative flex-grow md:flex-grow-0 md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search ticket or name..."
              className="pl-10 pr-4 py-2 w-full rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brown-500 focus:border-transparent"
            />
          </div>
          
          {/* Refresh Button */}
          <button 
            onClick={() => fetchOrders()}
            className="p-2 rounded-lg hover:bg-gray-100 text-brown-700" 
            title="Refresh Orders"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Order Count Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-yellow-400">
          <p className="text-sm text-gray-500 font-medium">Pending</p>
          <p className="text-2xl font-bold">{localOrders.filter(o => o.status === 'pending').length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-orange-400">
          <p className="text-sm text-gray-500 font-medium">Preparing</p>
          <p className="text-2xl font-bold">{localOrders.filter(o => o.status === 'preparing').length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-400">
          <p className="text-sm text-gray-500 font-medium">Ready</p>
          <p className="text-2xl font-bold">{localOrders.filter(o => o.status === 'ready').length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-400">
          <p className="text-sm text-gray-500 font-medium">Completed Today</p>
          <p className="text-2xl font-bold">
            {localOrders.filter(o => {
              if (o.status !== 'completed') return false;
              
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              
              // Use updated_at for completed orders as it's updated when status changes
              const orderDate = new Date(o.updatedAt || o.timestamp);
              orderDate.setHours(0, 0, 0, 0);
              return orderDate.getTime() === today.getTime();
            }).length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
        <div className="grid grid-cols-12 gap-2 p-4 border-b bg-gray-50 font-medium text-sm md:text-base">
          <div className="col-span-2 md:col-span-1">Ticket #</div>
          <div className="col-span-2">Customer</div>
          <div className="col-span-5 md:col-span-6">Items</div>
          <div className="col-span-2 md:col-span-1">Time</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-2 md:col-span-1">Action</div>
        </div>

        <div className="divide-y max-h-[calc(100vh-280px)] overflow-y-auto">
          {filteredOrders.length === 0 && (
            <div className="text-center py-16 px-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-500 text-lg">
                {searchQuery 
                  ? `No orders found matching "${searchQuery}".` 
                  : activeTab === 'active' 
                    ? "There are no active orders currently." 
                    : "There are no completed orders to display."}
              </p>
              {searchQuery && (
                <button 
                  onClick={() => setInputValue('')}
                  className="mt-4 text-brown-600 hover:text-brown-800 font-medium"
                >
                  Clear search
                </button>
              )}
            </div>
          )}
          
          {filteredOrders.map(order => (
            <div 
              key={order.id} 
              className={`grid grid-cols-12 gap-2 p-4 items-center ${
                order.status === 'ready' ? 'bg-blue-50' :
                order.status === 'pending' ? 'bg-yellow-50' : ''
              } hover:bg-gray-50 transition-colors`}
            >
              <div className="col-span-2 md:col-span-1 font-bold text-lg">{order.ticketNumber}</div>
              <div className="col-span-2 font-medium truncate">{order.customerName}</div>
              
              <div className="col-span-5 md:col-span-6">
                <div className="flex flex-wrap gap-2">
                  {order.items.map((item, index) => (
                    <div key={index} className="bg-white rounded-lg p-2 shadow-sm border border-gray-200 flex-grow md:flex-grow-0">
                      <p className="font-bold text-base">
                        {item.quantity}× {item.name}
                      </p>
                      {/* Display grouped customizations */}
                      {item.customizations && item.customizations.length > 0 && (
                        <ul className="text-xs text-gray-600 mt-1 space-y-0.5">
                          {item.customizations.map((cust, custIndex) => (
                            <li key={custIndex} className="flex">
                              <span className="font-medium mr-1">{cust.group}:</span> {cust.option}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="col-span-2 md:col-span-1 text-sm text-gray-500">
                {formatRelativeTime(order.createdAt || '')}
              </div>
              
              <div className="col-span-1">
                <span className={`px-2 py-1 rounded-full text-sm font-medium inline-flex items-center ${
                  order.status === 'completed' ? 'bg-green-100 text-green-800' :
                  order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                  order.status === 'preparing' ? 'bg-orange-100 text-orange-800' :
                  order.status === 'ready' ? 'bg-blue-100 text-blue-800' :
                  order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {order.status === 'ready' && (
                    <span className="h-2 w-2 bg-blue-500 rounded-full mr-1.5 animate-pulse"></span>
                  )}
                  {order.status === 'pending' && (
                    <span className="h-2 w-2 bg-yellow-500 rounded-full mr-1.5"></span>
                  )}
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
              </div>
              
              <div className="col-span-2 md:col-span-1 flex gap-1 md:gap-2 flex-wrap">
                {order.status === 'pending' && ['manager', 'cashier', 'employee'].includes(userRole || '') && (
                  <button
                    onClick={() => handleUpdateStatus(order.id, 'preparing')}
                    className="px-3 py-1 text-white rounded-lg bg-green-500 hover:bg-green-600 text-sm font-medium shadow-sm flex-grow"
                    title="Accept Order"
                  >
                    Accept
                  </button>
                )}
                
                {order.status === 'preparing' && ['manager', 'cook', 'employee'].includes(userRole || '') && (
                  <button
                    onClick={() => handleUpdateStatus(order.id, 'ready')}
                    className="px-3 py-1 text-white rounded-lg bg-blue-500 hover:bg-blue-600 text-sm font-medium shadow-sm flex-grow"
                    title="Mark as Ready"
                  >
                    Ready
                  </button>
                )}
                
                {order.status === 'ready' && ['manager', 'cashier', 'employee'].includes(userRole || '') && (
                  <button
                    onClick={() => handleUpdateStatus(order.id, 'completed')}
                    className="px-3 py-1 text-white rounded-lg bg-purple-500 hover:bg-purple-600 text-sm font-medium shadow-sm flex-grow"
                    title="Mark as Completed"
                  >
                    Complete
                  </button>
                )}
                
                {order.status !== 'completed' && order.status !== 'cancelled' && ['manager', 'cashier'].includes(userRole || '') && (
                  <button
                    onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                    className="px-1 py-1 text-red-500 rounded-lg hover:bg-red-50 text-sm"
                    title="Cancel Order"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                
                {(order.status === 'completed' || order.status === 'cancelled') && ['manager', 'cashier'].includes(userRole || '') && (
                  <button
                    onClick={() => handleArchiveOrder(order.id)}
                    className="px-3 py-1 text-gray-600 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium shadow-sm flex-grow"
                    title="Archive Order"
                  >
                    Archive
                  </button>
                )}
              </div>
            </div>
          ))}
        </div> 
      </div>
      
      {/* Auto-refresh indicator */}
      <div className="mt-4 text-center text-sm text-gray-500">
        Orders automatically refresh every 30 seconds
      </div>
    </div> 
  );
};

export default Order; 