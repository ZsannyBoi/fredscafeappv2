import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { toast } from 'react-toastify';

// Define types for membership data
interface MembershipTier {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  benefits: string[];
  pointsMultiplier: number;
}

interface MembershipTransaction {
  transaction_id: number;
  tier: string;
  amount: number;
  transaction_date: string;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  end_date: string | null;
}

interface MembershipManagerProps {
  user: User | null;
  updateUser: (userData: Partial<User>) => void;
}

const MembershipManager: React.FC<MembershipManagerProps> = ({ user, updateUser }) => {
  const [membershipTiers, setMembershipTiers] = useState<MembershipTier[]>([]);
  const [membershipHistory, setMembershipHistory] = useState<MembershipTransaction[]>([]);
  const [activeMembership, setActiveMembership] = useState<MembershipTransaction | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');

  // Fetch membership tiers and user's membership history
  useEffect(() => {
    const fetchMembershipData = async () => {
      if (!user?.internalId) return;
      
      setLoading(true);
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          toast.error('Authentication required');
          return;
        }
        
        // Fetch available membership tiers
        const tiersResponse = await fetch('http://localhost:3001/api/memberships/tiers', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!tiersResponse.ok) {
          throw new Error('Failed to fetch membership tiers');
        }
        
        const tiersData = await tiersResponse.json();
        setMembershipTiers(tiersData.tiers);
        
        // Fetch user's membership history
        const historyResponse = await fetch(`http://localhost:3001/api/users/${user.internalId}/memberships`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!historyResponse.ok) {
          throw new Error('Failed to fetch membership history');
        }
        
        const historyData = await historyResponse.json();
        setMembershipHistory(historyData.memberships || []);
        setActiveMembership(historyData.activeMembership);
        
        // If user has an active membership, preselect that tier
        if (historyData.activeMembership) {
          setSelectedTier(historyData.activeMembership.tier);
        }
      } catch (error: any) {
        console.error('Error fetching membership data:', error);
        toast.error(error.message || 'Error loading membership data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchMembershipData();
  }, [user?.internalId]);

  // Handle tier selection
  const handleTierSelect = (tierId: string) => {
    setSelectedTier(tierId);
  };

  // Handle billing cycle toggle
  const handleBillingCycleChange = (cycle: 'monthly' | 'yearly') => {
    setBillingCycle(cycle);
  };

  // Calculate price based on selected tier and billing cycle
  const getPrice = (tierId: string) => {
    const tier = membershipTiers.find(t => t.id === tierId);
    if (!tier) return 0;
    
    return billingCycle === 'monthly' ? tier.monthlyPrice : tier.yearlyPrice;
  };

  // Subscribe to a membership
  const handleSubscribe = async () => {
    if (!user?.internalId || !selectedTier) {
      toast.error('Please select a membership tier');
      return;
    }
    
    if (activeMembership) {
      toast.error('You already have an active membership. Please cancel it first.');
      return;
    }
    
    setSubscribing(true);
    setProcessingStatus('pending');
    
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        toast.error('Authentication required');
        return;
      }
      
      const price = getPrice(selectedTier);
      
      // In a real application, here you would handle payment processing
      // For this demo, we'll simulate a successful payment
      
      const response = await fetch(`http://localhost:3001/api/users/${user.internalId}/memberships`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tier: selectedTier,
          amount: price,
          isPaid: true, // In a real app, this would come from payment gateway
          duration: billingCycle,
          status: 'pending' // Set initial status to pending for approval
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to subscribe to membership');
      }
      
      const result = await response.json();
      
      if (result.approvalUrl) {
        // Open approval window
        const approvalWindow = window.open(
          result.approvalUrl,
          '_blank',
          'width=800,height=600,resizable=yes,scrollbars=yes'
        );
        
        if (!approvalWindow) {
          throw new Error('Please allow popups for this site to complete the membership approval process.');
        }
        
        toast.info('Membership application submitted. Waiting for approval...');
        
        // Update processing status to reflect waiting for approval
        setProcessingStatus('success');
        
        // Hide confirmation dialog after showing the pending message
        setTimeout(() => {
          setShowConfirmation(false);
          setProcessingStatus('idle');
        }, 3000);
        
        // Don't update local state yet - wait for approval
        return;
      } else {
        // Update local state immediately for auto-approved memberships
        setActiveMembership(result.membership);
        setMembershipHistory(prev => [result.membership, ...prev]);
        
        // Update user data in parent component
        if (result.user && updateUser) {
          updateUser({
            ...user,
            membershipTier: result.user.membership_tier || undefined
          });
        }
        
        setProcessingStatus('success');
        toast.success('Membership subscription successful!');
      }
      
      // Hide confirmation dialog after success
      setTimeout(() => {
        setShowConfirmation(false);
        setProcessingStatus('idle');
      }, 2000);
    } catch (error: any) {
      console.error('Error subscribing to membership:', error);
      setProcessingStatus('error');
      toast.error(error.message || 'Failed to subscribe to membership');
    } finally {
      setSubscribing(false);
    }
  };

  // Cancel membership
  const handleCancelMembership = async () => {
    if (!user?.internalId || !activeMembership) {
      toast.error('No active membership to cancel');
      return;
    }
    
    setCancelling(true);
    
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        toast.error('Authentication required');
        return;
      }
      
      const response = await fetch(
        `http://localhost:3001/api/users/${user.internalId}/memberships/${activeMembership.transaction_id}/cancel`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to cancel membership');
      }
      
      // Update local state
      setActiveMembership(null);
      
      // Update membership history
      const updatedHistory = membershipHistory.map(m => 
        m.transaction_id === activeMembership.transaction_id
          ? { ...m, status: 'cancelled' as const }
          : m
      );
      setMembershipHistory(updatedHistory);
      
      // Update user data in parent component
      if (updateUser) {
        updateUser({
          ...user,
          membershipTier: null as unknown as undefined
        });
      }
      
      toast.success('Membership cancelled successfully');
    } catch (error: any) {
      console.error('Error cancelling membership:', error);
      toast.error(error.message || 'Failed to cancel membership');
    } finally {
      setCancelling(false);
    }
  };

  // Open confirmation dialog
  const openConfirmation = () => {
    if (!selectedTier) {
      toast.error('Please select a membership tier');
      return;
    }
    
    setShowConfirmation(true);
  };

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Loading membership information...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
      <div className="p-6">
        <h3 className="text-xl font-semibold text-brown-800 mb-4">Membership</h3>
        
        {/* Current Membership Status */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-700 mb-2">Current Status</h4>
          {activeMembership ? (
            <div>
              <div className="flex items-center mb-2">
                <span className="text-sm font-medium mr-2">Active Tier:</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                  {activeMembership.tier}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-1">
                <span className="font-medium">Subscription Date:</span> {formatDate(activeMembership.transaction_date)}
              </p>
              {activeMembership.end_date && (
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Renewal Date:</span> {formatDate(activeMembership.end_date)}
                </p>
              )}
              <button
                onClick={() => handleCancelMembership()}
                disabled={cancelling}
                className="mt-2 px-3 py-1.5 bg-white text-red-600 border border-red-600 rounded-md text-sm font-medium hover:bg-red-50 transition-colors"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Membership'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-600">You don't have an active membership.</p>
          )}
        </div>
        
        {/* Membership Selection */}
        {!activeMembership && (
          <div className="mb-6">
            <h4 className="font-medium text-gray-700 mb-3">Select a Membership Tier</h4>
            
            {/* Billing Cycle Toggle */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex p-1 bg-gray-100 rounded-lg">
                <button
                  onClick={() => handleBillingCycleChange('monthly')}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${
                    billingCycle === 'monthly' 
                      ? 'bg-white shadow-sm text-blue-700' 
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => handleBillingCycleChange('yearly')}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${
                    billingCycle === 'yearly' 
                      ? 'bg-white shadow-sm text-blue-700' 
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Yearly (Save 15%)
                </button>
              </div>
            </div>
            
            {/* Membership Tiers Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {membershipTiers.map((tier) => (
                <div
                  key={tier.id}
                  className={`border rounded-xl p-5 cursor-pointer transition-all ${
                    selectedTier === tier.id
                      ? 'border-blue-500 shadow-md bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => handleTierSelect(tier.id)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <h5 className="text-lg font-semibold">{tier.name}</h5>
                    <div className={`w-5 h-5 rounded-full border-2 ${
                      selectedTier === tier.id
                        ? 'border-blue-600 bg-blue-600'
                        : 'border-gray-400'
                    }`}>
                      {selectedTier === tier.id && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                          <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-xl font-bold text-gray-900">
                      ${billingCycle === 'monthly' ? tier.monthlyPrice : tier.yearlyPrice}
                      <span className="text-sm font-normal text-gray-500">
                        /{billingCycle === 'monthly' ? 'month' : 'year'}
                      </span>
                    </p>
                  </div>
                  
                  <ul className="space-y-2 mb-4">
                    {tier.benefits.map((benefit, index) => (
                      <li key={index} className="flex items-start">
                        <svg className="w-5 h-5 text-green-500 mr-1.5 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        <span className="text-sm text-gray-600">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            
            {/* Subscribe Button */}
            <div className="mt-6 text-center">
              <button
                onClick={openConfirmation}
                disabled={!selectedTier || subscribing}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-300"
              >
                Subscribe Now
              </button>
            </div>
          </div>
        )}
        
        {/* Membership History */}
        {membershipHistory.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-700 mb-3">Membership History</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {membershipHistory.map((membership) => (
                    <tr key={membership.transaction_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {membership.tier}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(membership.transaction_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${typeof membership.amount === 'number' 
                          ? membership.amount.toFixed(2) 
                          : parseFloat(membership.amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${membership.status === 'active' ? 'bg-green-100 text-green-800' : 
                            membership.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            membership.status === 'expired' ? 'bg-gray-100 text-gray-800' :
                            membership.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-yellow-100 text-yellow-800'}`}>
                          {membership.status}
                        </span>
                        {membership.status === 'pending' && (
                          <span className="ml-2 text-xs text-gray-500">
                            Awaiting approval
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(membership.end_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      
      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                {processingStatus === 'success' ? (
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                    <svg className="h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : processingStatus === 'error' ? (
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                    <svg className="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                ) : (
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                    <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {processingStatus === 'success' ? 'Subscription Successful' :
                     processingStatus === 'error' ? 'Subscription Failed' :
                     processingStatus === 'pending' ? 'Processing Payment' :
                     'Confirm Subscription'}
                  </h3>
                  <div className="mt-2">
                    {processingStatus === 'idle' && (
                      <div>
                        <p className="text-sm text-gray-500">
                          You are about to subscribe to the <span className="font-medium">{
                            membershipTiers.find(t => t.id === selectedTier)?.name
                          }</span> membership plan.
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          You will be charged <span className="font-medium">${getPrice(selectedTier).toFixed(2)}</span> {billingCycle === 'monthly' ? 'per month' : 'per year'}.
                        </p>
                      </div>
                    )}
                    
                    {processingStatus === 'pending' && (
                      <p className="text-sm text-gray-500">
                        Please wait while we process your payment...
                      </p>
                    )}
                    
                    {processingStatus === 'success' && (
                      <p className="text-sm text-gray-500">
                        Your membership has been activated successfully!
                      </p>
                    )}
                    
                    {processingStatus === 'error' && (
                      <p className="text-sm text-gray-500">
                        There was an error processing your subscription. Please try again.
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                {processingStatus === 'idle' && (
                  <>
                    <button
                      type="button"
                      onClick={handleSubscribe}
                      disabled={subscribing}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:col-start-2"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowConfirmation(false)}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:col-start-1"
                    >
                      Cancel
                    </button>
                  </>
                )}
                
                {(processingStatus === 'success' || processingStatus === 'error') && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowConfirmation(false);
                      setProcessingStatus('idle');
                    }}
                    className="w-full col-span-2 inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembershipManager; 