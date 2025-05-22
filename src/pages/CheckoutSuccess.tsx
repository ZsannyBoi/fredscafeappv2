import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CheckoutSuccess: React.FC = () => {
  const [countdown, setCountdown] = useState(5);
  const navigate = useNavigate();

  // Auto-redirect to menu after countdown
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      navigate('/'); // Redirect to home/menu after countdown
    }
  }, [countdown, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        <div className="mb-6 text-green-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Order Successful!</h1>
        <p className="text-gray-600 mb-6">
          Your order has been placed successfully and is being processed. 
          Thank you for your purchase!
        </p>
        <div className="text-sm text-gray-500 mb-4">
          Redirecting to home in {countdown} seconds...
        </div>
        <button 
          onClick={() => navigate('/')}
          className="w-full bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700"
        >
          Return to Home
        </button>
      </div>
    </div>
  );
};

export default CheckoutSuccess; 