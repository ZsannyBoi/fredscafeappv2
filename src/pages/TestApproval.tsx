import React, { useState, useEffect } from 'react';

interface ApprovalRequest {
  type: 'password_reset' | 'checkout';
  data: {
    // For password reset
    email?: string;
    token?: string;
    // For checkout
    orderId?: string;
    orderTotal?: number;
    customerName?: string;
    items?: { name: string; quantity: number }[];
  };
}

const TestApproval: React.FC = () => {
  const [approvalData, setApprovalData] = useState<ApprovalRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const data = urlParams.get('data');
    if (data) {
      try {
        const parsedData = JSON.parse(decodeURIComponent(data));
        setApprovalData(parsedData);
      } catch (error) {
        setError('Invalid approval data');
      }
    }
  }, []);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setError(null);

    if (!approvalData?.data?.token || !approvalData?.data?.email) {
      setError('Missing reset token or email');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: approvalData.data.token,
          email: approvalData.data.email,
          newPassword
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      alert('Password has been reset successfully. Please log in with your new password.');
      window.close();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!approvalData) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/api/orders/approve-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId: approvalData.data.orderId }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve order');
      }

      // Send message to parent window
      if (window.opener) {
        window.opener.postMessage({ type: 'ORDER_COMPLETED' }, '*');
      }

      // Close this window
      window.close();
    } catch (error) {
      console.error('Error approving order:', error);
      setError('Failed to approve order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!approvalData) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/api/orders/reject-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId: approvalData.data.orderId }),
      });

      if (!response.ok) {
        throw new Error('Failed to reject order');
      }

      // Send message to parent window
      if (window.opener) {
        window.opener.postMessage({ 
          type: 'ORDER_REJECTED',
          reason: 'Order was rejected by the approver'
        }, '*');
      }

      // Close this window
      window.close();
    } catch (error) {
      console.error('Error rejecting order:', error);
      setError('Failed to reject order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={() => window.close()}
            className="w-full bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  if (!approvalData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <div className="text-gray-600 mb-4">Loading request...</div>
        </div>
      </div>
    );
  }

  if (approvalData.type === 'password_reset') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <h2 className="text-2xl font-bold mb-4">Reset Password</h2>
          
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            {passwordError && (
              <div className="text-red-600 text-sm">{passwordError}</div>
            )}
            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render checkout approval
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Order Approval Request</h2>
        
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Order Details:</h3>
          <div className="bg-gray-50 p-4 rounded">
            <p><span className="font-medium">Customer:</span> {approvalData.data.customerName}</p>
            <p><span className="font-medium">Order Total:</span> ${approvalData.data.orderTotal?.toFixed(2)}</p>
            <div className="mt-2">
              <p className="font-medium">Items:</p>
              <ul className="list-disc list-inside">
                {approvalData.data.items?.map((item, index) => (
                  <li key={index}>
                    {item.quantity}x {item.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleReject}
            disabled={loading}
            className="flex-1 bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Reject'}
          </button>
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestApproval; 