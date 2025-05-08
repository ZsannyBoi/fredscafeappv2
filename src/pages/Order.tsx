import React, { useState, useEffect } from 'react';
import { OrderItem } from '../types'; // Import OrderItem from types.ts

interface OrderPageProps {
  orders: OrderItem[];
  updateOrderStatus: (orderId: string, newStatus: OrderItem['status']) => void;
}

const Order: React.FC<OrderPageProps> = ({ orders, updateOrderStatus }) => {
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const timerId = setTimeout(() => {
      setSearchQuery(inputValue);
    }, 500); // 500ms delay

    return () => {
      clearTimeout(timerId);
    };
  }, [inputValue]);

  // Filter orders based on search query (example: by ticketNumber or customerName)
  const filteredOrders = orders.filter(order => 
    order.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                    {item.quantity}x {item.name}
                    <span className="text-gray-500 text-xs block">
                      {item.customizations.join(' • ')}
                    </span>
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
                {order.status === 'pending' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'preparing')}
                    className="px-3 py-1 text-white rounded-lg bg-green-500 hover:bg-green-600"
                    title="Accept Order"
                  >
                    Accept
                  </button>
                )}
                {order.status === 'preparing' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'ready')}
                    className="px-3 py-1 bg-blue-500 text-white rounded-lg"
                  >
                    Mark Ready
                  </button>
                )}
                {order.status === 'ready' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'completed')}
                    className="px-3 py-1 bg-green-500 text-white rounded-lg"
                  >
                    Complete
                  </button>
                )}
                {['pending', 'preparing'].includes(order.status) && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'cancelled')}
                    className="px-3 py-1 bg-red-500 text-white rounded-lg"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Order; 