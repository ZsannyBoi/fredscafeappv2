import React, { useState, useEffect, useCallback } from 'react';
import { OrderItem, User } from '../types'; // Import OrderItem and User

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
    // Add fetchOrders to dependency array
  }, [fetchOrders]);

  // Client-side filtering (update to use localOrders)
  // Consider backend filtering for better performance
  const filteredOrders = localOrders.filter(order =>
    // If selectedOrderId is not null, only show that specific order
    (selectedOrderId ? order.id === selectedOrderId : true) &&
    (searchQuery ? 
      order.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase())
      : true)
  );

  // Effect to clear selectedOrderId when component unmounts
  useEffect(() => {
    return () => {
      // Clear the selected order ID when the component unmounts
      setSelectedOrderId(null);
    };
  }, [setSelectedOrderId]);

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

      // Optional: If the backend returns the updated order, update state with it
      // const updatedOrderFromServer: OrderItem = await response.json();
      // setLocalOrders(prevOrders =>
      console.log(`Successfully updated order ${orderId} to status ${newStatus}`);

    } catch (updateError: any) {
      console.error(`Failed to update order ${orderId} status:`, updateError);
      // Revert optimistic update if not already done
       setLocalOrders(prevOrders =>
           prevOrders.map(order =>
             order.id === orderId ? originalOrder : order
           )
        );
      alert(`Error updating order status: ${updateError.message}`);
    }
  };

  // --- NEW: Function to handle archiving an order ---
  const handleArchiveOrder = async (orderId: string) => {
    if (!user || (user.role !== 'manager' && user.role !== 'cashier')) {
      alert('Permission denied.'); // Should not happen if button is hidden, but good practice
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
      // No need to refetch on success, optimistic update handles it.

    } catch (archiveError: any) {
      console.error(`Failed to archive order ${orderId}:`, archiveError);
      // Ensure state is reverted if not already done
      fetchOrders(); // Refetch to be sure
      alert(`Error archiving order: ${archiveError.message}`);
    }
  };

  // --- Render Logic ---
  // console.log('[Order.tsx] Rendering with state:', { isLoading, error, localOrders }); // Removed log

  // Handle loading state
  if (isLoading) {
    return <div className="p-6 text-center text-gray-500">Loading orders...</div>; 
  }

  // Handle error state
  if (error) {
    return <div className="p-6 text-center text-red-500">Error: {error}</div>;
  }

  // Main Render
  return (
    <div className="text-brown-800 p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Orders</h1>
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search by ticket or name..."
            className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brown-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-6 gap-4 p-4 border-b bg-gray-50 font-medium">
          <div>Ticket #</div>
          <div>Customer</div>
          <div className="col-span-2">Items</div>
          <div>Status</div>
          <div>Action</div>
        </div>

        <div className="divide-y">
          {filteredOrders.length === 0 && (
            <p className="text-center py-10 text-gray-500">
              {searchQuery ? `No orders found matching "${searchQuery}".` : "There are no orders currently."}
            </p>
          )}
          {filteredOrders.map(order => (
            <div key={order.id} className="grid grid-cols-6 gap-4 p-4 items-center">
              <div className="font-medium">{order.ticketNumber}</div>
              <div>{order.customerName}</div>
              <div className="col-span-2">
                {order.items.map((item, index) => (
                  <div key={index} className="text-sm">
                    <p className="font-medium">{item.quantity}x {item.name}</p>
                    {/* Display grouped customizations */}
                    {item.customizations && item.customizations.length > 0 && (
                      <ul className="text-xs text-gray-600 pl-3 list-disc list-inside mt-1">
                        {item.customizations.map((cust, custIndex) => (
                          <li key={custIndex}>
                             <span className="font-medium">{cust.group}:</span> {cust.option}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
              <div>
                <span className={`px-2 py-1 rounded-full text-sm ${
                  order.status === 'completed' ? 'bg-green-100 text-green-800' :
                  order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                  order.status === 'preparing' ? 'bg-yellow-100 text-yellow-800' :
                  order.status === 'ready' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
              </div>
              <div className="flex gap-2">
                {order.status === 'pending' && ['manager', 'cashier', 'employee'].includes(userRole || '') && (
                  <button
                    onClick={() => handleUpdateStatus(order.id, 'preparing')}
                    className="px-3 py-1 text-white rounded-lg bg-green-500 hover:bg-green-600"
                    title="Accept Order"
                  >
                    Accept
                  </button>
                )}
                {order.status === 'preparing' && ['manager', 'cook', 'employee'].includes(userRole || '') && (
                  <button
                    onClick={() => handleUpdateStatus(order.id, 'ready')}
                    className="px-3 py-1 text-white rounded-lg bg-blue-500 hover:bg-blue-600"
                  >
                    Mark Ready
                  </button>
                )}
                {order.status === 'ready' && ['manager', 'cashier', 'employee'].includes(userRole || '') && (
                  <button
                    onClick={() => handleUpdateStatus(order.id, 'completed')}
                    className="px-3 py-1 text-white rounded-lg bg-purple-500 hover:bg-purple-600"
                  >
                    Complete
                  </button>
                )}
                {order.status !== 'completed' && order.status !== 'cancelled' && ['manager', 'cashier'].includes(userRole || '') && (
                  <button
                    onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                    className="px-3 py-1 text-white rounded-lg bg-red-500 hover:bg-red-600"
                  >
                    Cancel
                  </button>
                )}
                {(order.status === 'completed' || order.status === 'cancelled') && ['manager', 'cashier'].includes(userRole || '') && (
                  <button
                    onClick={() => handleArchiveOrder(order.id)}
                    className="px-3 py-1 text-white rounded-lg bg-gray-500 hover:bg-gray-600"
                  >
                    Archive
                  </button>
                )}
              </div>
            </div>
          ))}
        </div> 
      </div> 
    </div> 
  ); // End of main return

  // This return null is now logically unnecessary if isLoading/error handle all other cases
  // but doesn't hurt to leave it as a safety net if localOrders could be null/undefined somehow.
  // return null; 
};

export default Order; 