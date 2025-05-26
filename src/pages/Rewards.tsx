import React, { useState, useEffect } from 'react';
import { RawRewardItem, CustomerInfo, User, CustomerVoucher, RawRewardItemCriteria, TimeWindow } from '../types'; // Import types, added TimeWindow

// --- Helper function for safely parsing JSON strings ---
const safeJsonParse = (jsonString: string, defaultValue = {}) => {
  try {
    return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
  } catch (e) {
    console.error('Error parsing JSON:', e);
    return defaultValue;
  }
};

// Define interface for Reward data AS DISPLAYED ON THIS PAGE (includes dynamic status)
interface ProcessedRewardItem extends RawRewardItem {
    currentStatus: 'Claim' | 'Claimed' | 'Ineligible' | 'ActiveVoucher'; 
    progressMessage: string;
    instanceId?: string; // For vouchers, to uniquely identify the claimed instance
    isVoucher?: boolean; // Flag to identify if this is from customerInfo.activeVouchers
}

// Updated Props for the Rewards component
interface RewardsProps {
    targetCustomerId: string; // ID of the customer whose rewards are being viewed
    user: User | null;        // Current logged-in user (for role checks, etc.)
}

// --- Eligibility Check Helper Functions ---

// Type for the result of individual criteria checks
interface CriteriaCheckResult {
    met: boolean;
    unmetMessage?: string;
    progressMessage?: string;
}

const checkPointCriteria = (criteria: RawRewardItemCriteria, customer: CustomerInfo): CriteriaCheckResult => {
  const result: CriteriaCheckResult = { met: true };
  if (criteria.minPoints) {
    if (customer.loyaltyPoints < criteria.minPoints) {
      result.met = false;
      result.unmetMessage = `Need ${criteria.minPoints - customer.loyaltyPoints} more points.`;
    } else {
      result.progressMessage = `${customer.loyaltyPoints}/${criteria.minPoints} points.`;
    }
  }
  return result;
};

const checkPurchaseCriteria = (criteria: RawRewardItemCriteria, customer: CustomerInfo): CriteriaCheckResult => {
  const result: CriteriaCheckResult = { met: true };
  if (criteria.minPurchasesMonthly) {
    if (customer.purchasesThisMonth < criteria.minPurchasesMonthly) {
      result.met = false;
      result.unmetMessage = `Need ${criteria.minPurchasesMonthly - customer.purchasesThisMonth} more purchase(s) this month.`;
    } else {
      result.progressMessage = `${customer.purchasesThisMonth}/${criteria.minPurchasesMonthly} purchases this month.`;
    }
  }
  // Note: minSpend, minSpendPerTransaction, cumulativeSpendTotal checks require more context (e.g., current transaction) 
  // or are better validated server-side. We add placeholders here.
  if (criteria.minSpend) { result.progressMessage = (result.progressMessage ? result.progressMessage + ' ' : '') + '(Min spend check required)'; }
  if (criteria.minSpendPerTransaction) { result.progressMessage = (result.progressMessage ? result.progressMessage + ' ' : '') + '(Min spend per transaction check required)'; }
  if (criteria.cumulativeSpendTotal) {
      if ((customer.lifetimeTotalSpend || 0) < criteria.cumulativeSpendTotal) {
          result.met = false;
          result.unmetMessage = (result.unmetMessage ? result.unmetMessage + ' ' : '') + `Requires total spend of $${criteria.cumulativeSpendTotal.toFixed(2)}.`;
      } else {
          result.progressMessage = (result.progressMessage ? result.progressMessage + ' ' : '') + `Total spend $${(customer.lifetimeTotalSpend || 0).toFixed(2)}/$${criteria.cumulativeSpendTotal.toFixed(2)}.`;
      }
  }
  return result;
};

const checkDateCriteria = (
    criteria: RawRewardItemCriteria, 
    customer: CustomerInfo, 
    today: Date, 
    currentMonth: number, 
    currentDay: number, 
    todayStr: string
): CriteriaCheckResult => {
  const result: CriteriaCheckResult = { met: true };
  let customerBirthMonth: number | null = null;
  let customerBirthDay: number | null = null;
  if (customer.birthDate) {
    try {
      const parts = customer.birthDate.split('-').map(Number);
      if (parts.length === 3) { customerBirthMonth = parts[1]; customerBirthDay = parts[2]; }
    } catch { /* ignore */ }
  }

  if (criteria.isBirthdayOnly) {
    if (customerBirthMonth !== currentMonth || customerBirthDay !== currentDay) {
      result.met = false; result.unmetMessage = 'Only on your birthday.';
    } else {
      result.progressMessage = 'Happy Birthday!';
    }
  }
  // Ensure birth month check doesn't conflict if birthday check already passed/failed
  if (result.met && criteria.isBirthMonthOnly && !criteria.isBirthdayOnly) {
     if (customerBirthMonth !== currentMonth) {
         result.met = false; result.unmetMessage = 'Only in your birth month.';
     } else {
         result.progressMessage = (result.progressMessage ? result.progressMessage + ' ' : '') + 'For your birth month!';
     }
  }

  if (criteria.validDateRange) {
    if (criteria.validDateRange.startDate && todayStr < criteria.validDateRange.startDate) {
      result.met = false; result.unmetMessage = (result.unmetMessage ? result.unmetMessage + ' ' : '') + `Starts ${criteria.validDateRange.startDate}.`;
    }
    if (result.met && criteria.validDateRange.endDate && todayStr > criteria.validDateRange.endDate) {
      result.met = false; result.unmetMessage = (result.unmetMessage ? result.unmetMessage + ' ' : '') + `Ended ${criteria.validDateRange.endDate}.`;
    }
  }
  return result;
};

const checkMembershipCriteria = (criteria: RawRewardItemCriteria, customer: CustomerInfo): CriteriaCheckResult => {
  const result: CriteriaCheckResult = { met: true };
  if (criteria.requiredCustomerTier && criteria.requiredCustomerTier.length > 0) {
    if (!customer.membershipTier) {
        result.met = false; result.unmetMessage = `Membership tier required.`;
    } else if (!criteria.requiredCustomerTier.includes(customer.membershipTier)) {
        result.met = false; result.unmetMessage = `Requires one of these tiers: ${criteria.requiredCustomerTier.join(', ')}.`;
    } else {
        result.progressMessage = `Tier ${customer.membershipTier} ok.`;
    }
  }
  return result;
};

const checkReferralCriteria = (criteria: RawRewardItemCriteria, customer: CustomerInfo): CriteriaCheckResult => {
  const result: CriteriaCheckResult = { met: true };
  if (criteria.minReferrals) {
    if ((customer.referralsMade || 0) < criteria.minReferrals) {
        result.met = false; result.unmetMessage = `Requires ${criteria.minReferrals - (customer.referralsMade || 0)} more referrals.`;
    } else {
        result.progressMessage = `${customer.referralsMade || 0}/${criteria.minReferrals} referrals.`;
    }
  }
  // Note: isReferralBonusForNewUser, isRewardForReferringUser are more flags than criteria checked here directly.
  return result;
};

const checkSignupCriteria = (criteria: RawRewardItemCriteria, customer: CustomerInfo): CriteriaCheckResult => {
  const result: CriteriaCheckResult = { met: true };
  if (criteria.isSignUpBonus) {
      // Simple check: assumes joinDate exists for eligible customers. Real check might involve date proximity.
      if (!customer.joinDate) {
          result.met = false; result.unmetMessage = 'For new sign-ups only.';
      } else {
          result.progressMessage = 'Welcome bonus!';
      }
  }
  return result;
};

const checkTimeWindowCriteria = (
    criteria: RawRewardItemCriteria, 
    currentDayOfWeek: number, 
    currentTime: string
): CriteriaCheckResult => {
  const result: CriteriaCheckResult = { met: true };
  if (criteria.activeTimeWindows && criteria.activeTimeWindows.length > 0) {
    const applicableWindow = criteria.activeTimeWindows.find(window => 
        window.daysOfWeek && window.daysOfWeek.includes(currentDayOfWeek) &&
        currentTime >= window.startTime && 
        currentTime <= window.endTime
    );
    if (!applicableWindow) {
      result.met = false; result.unmetMessage = 'Only valid during specific times/days.';
    }
  }
  return result;
};

const checkProductCriteria = (criteria: RawRewardItemCriteria): CriteriaCheckResult => {
    const result: CriteriaCheckResult = { met: true };
    // Note: These checks require context of items being purchased, usually done server-side or at checkout.
    if (criteria.requiredProductIds) { result.progressMessage = (result.progressMessage ? result.progressMessage + ' ' : '') + '(Specific product purchase check needed)'; }
    if (criteria.excludedProductIds) { result.progressMessage = (result.progressMessage ? result.progressMessage + ' ' : '') + '(Excluded product check needed)'; }
    if (criteria.requiresProductCategory) { result.progressMessage = (result.progressMessage ? result.progressMessage + ' ' : '') + '(Product category purchase check needed)'; }
    return result;
};


// --- Refactored Main Eligibility Check Function ---
const checkRewardEligibility = (
    reward: RawRewardItem, 
    customer: CustomerInfo,
    claimedVoucherInstances: CustomerVoucher[],
    claimedGeneralRewardIds: Set<string>,
    isVoucherInstance: boolean = false,
    voucherInstance?: CustomerVoucher
): Pick<ProcessedRewardItem, 'currentStatus' | 'progressMessage'> => {
    // SECURITY NOTE: This entire function performs client-side eligibility checks.
    // While useful for UI feedback, these checks MUST be re-validated on the server before any reward is granted or claimed.
    // The server should be the ultimate authority on eligibility.

    // 1. Handle Voucher Instance Status First
    if (isVoucherInstance && voucherInstance) {
        if (voucherInstance.status === 'claimed') return { currentStatus: 'Claimed', progressMessage: 'This voucher has already been used.' };
        if (voucherInstance.status === 'expired') return { currentStatus: 'Ineligible', progressMessage: 'This voucher has expired.' };
        if (voucherInstance.status === 'active') return { currentStatus: 'Claim', progressMessage: voucherInstance.description || 'This voucher is active and ready to use.' };
        // If voucher status is somehow unexpected, fallback to general checks?
    }

    // 2. Check if this general reward ID is in the claimedGeneralRewardIds set (for non-vouchers)
    if (!isVoucherInstance && claimedGeneralRewardIds.has(reward.id)) {
        return { currentStatus: 'Claimed', progressMessage: 'You have already claimed this reward.' };
    }

    // 3. Check Eligibility Criteria using Helper Functions
    let isEligible = true;
    const progressMessages: string[] = [];
    const unmetMessages: string[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    const currentTime = today.getHours().toString().padStart(2, '0') + ":" + today.getMinutes().toString().padStart(2, '0'); // HH:MM
    const currentDayOfWeek = today.getDay(); // 0=Sun, 6=Sat

    const criteria = reward.criteria;
    if (criteria) {
        const checks: CriteriaCheckResult[] = [
            checkPointCriteria(criteria, customer),
            checkPurchaseCriteria(criteria, customer),
            checkDateCriteria(criteria, customer, today, currentMonth, currentDay, todayStr),
            checkMembershipCriteria(criteria, customer),
            checkReferralCriteria(criteria, customer),
            checkSignupCriteria(criteria, customer),
            checkTimeWindowCriteria(criteria, currentDayOfWeek, currentTime),
            checkProductCriteria(criteria) // Checks requiring more context
        ];

        checks.forEach(check => {
            if (!check.met) isEligible = false;
            if (check.unmetMessage) unmetMessages.push(check.unmetMessage);
            if (check.progressMessage) progressMessages.push(check.progressMessage);
        });
    }

    // 4. Determine Final Status and Message
    if (isEligible) {
        let message = 'Eligible to claim!';
        if (progressMessages.length > 0) {
            message = progressMessages.join(' ');
        }
        if (reward.pointsCost && customer.loyaltyPoints < reward.pointsCost) {
             // Eligible based on criteria, but not enough points to redeem
             return { currentStatus: 'Ineligible', progressMessage: `Eligible, but need ${reward.pointsCost} points to redeem (Have ${customer.loyaltyPoints}).` };
        }
        return { currentStatus: 'Claim', progressMessage: message };
    } else {
        let message = 'Not eligible.';
        if (unmetMessages.length > 0) {
            message = unmetMessages.join(' ');
        } else if (reward.earningHint) {
            message = reward.earningHint; // Fallback to hint if no specific unmet criteria shown
        }
        return { currentStatus: 'Ineligible', progressMessage: message };
    }
};


const Rewards: React.FC<RewardsProps> = ({ 
    targetCustomerId, // Use targetCustomerId from props
    user 
}) => {
    // --- State for fetched data ---
    const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
    const [rewardsData, setRewardsData] = useState<RawRewardItem[]>([]);
    const [claimedGeneralRewardIds, setClaimedGeneralRewardIds] = useState<string[]>([]); // New state for claimed general reward IDs
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // --- Local UI State ---
    const [processedRewards, setProcessedRewards] = useState<ProcessedRewardItem[]>([]);
    const [selectedReward, setSelectedReward] = useState<ProcessedRewardItem | null>(null);
    const [rewardSearchTerm, setRewardSearchTerm] = useState('');
    const [isClaiming, setIsClaiming] = useState<string | null>(null); // Track claiming process (rewardId or instanceId)
    const [claimedStatusOverrides, setClaimedStatusOverrides] = useState<Record<string, boolean>>({}); // Track claimed status locally after successful API call
    const [claimingRewardId, setClaimingRewardId] = useState<string | null>(null); // Track which reward is being claimed
    const [claimingError, setClaimingError] = useState<string | null>(null); // Track claiming errors

    // --- Fetch Rewards and Customer Info --- 
    useEffect(() => {
        // Only proceed if targetCustomerId is valid (not null or undefined)
        if (!targetCustomerId) {
            console.log('[Rewards.tsx] No targetCustomerId available, skipping fetch.');
            setIsLoading(false); // Ensure loading state is false if skipping fetch
            setCustomerInfo(null);
            setProcessedRewards([]);
            setRewardsData([]);
            setClaimedStatusOverrides({});
            setClaimedGeneralRewardIds([]);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            setCustomerInfo(null); // Reset while fetching
            setRewardsData([]);
            setClaimedStatusOverrides({}); // Reset overrides
            setClaimedGeneralRewardIds([]); // Reset claimed general reward IDs

            try {
                const token = localStorage.getItem('authToken');
                const headers = { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };

                // Fetch Customer Info (includes active vouchers)
                const customerInfoResponse = await fetch(`http://localhost:3001/api/customers/${targetCustomerId}/info`, { headers });
                if (!customerInfoResponse.ok) throw new Error(`Failed to fetch customer info: ${customerInfoResponse.statusText}`);
                const customerData: CustomerInfo = await customerInfoResponse.json();
                setCustomerInfo(customerData);
                // Capture claimed general reward IDs from the response
                setClaimedGeneralRewardIds(customerData.claimedGeneralRewardIds || []);

                // Fetch Reward Definitions
                const rewardsResponse = await fetch('http://localhost:3001/api/rewards/definitions', { headers });
                if (!rewardsResponse.ok) throw new Error(`Failed to fetch reward definitions: ${rewardsResponse.statusText}`);
                const rewardDefs: RawRewardItem[] = await rewardsResponse.json();
                // TODO: Process rewardDefs if criteria is JSON string
                setRewardsData(rewardDefs);

                // TODO: Fetch claimed general rewards for this customer if needed separately 
                // OR adjust backend /info endpoint to include this.
                // For now, eligibility check won't know about previously claimed general rewards.
                // Let's assume for now `POST /api/rewards/claim` handles the duplicate check.

            } catch (fetchError: any) {
                console.error("Error fetching rewards page data:", fetchError);
                setError(fetchError.message || "Failed to load rewards data.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [targetCustomerId, user?.role]); // Add user.role to dependencies

    // --- Process Rewards Effect (Runs when fetched data changes) ---
    useEffect(() => {
        // Corrected condition: Check if rewardsData is empty or null/undefined
        if (!customerInfo || !rewardsData || rewardsData.length === 0) {
            setProcessedRewards([]); // Clear if no data
            return;
        }

        console.log('[Rewards.tsx] Processing rewards. Customer Info:', customerInfo, 'Reward Definitions:', rewardsData);

        // Use fetched customerInfo data (specifically activeVouchers and claimedGeneralRewardIds)
        const claimedVoucherInstances = customerInfo.activeVouchers || [];
        const claimedGeneralRewardIds = new Set(customerInfo.claimedGeneralRewardIds || []); // Use claimedGeneralRewardIds

        const processed = rewardsData.map(reward => {
            // Map RawRewardItem properties (snake_case) to ProcessedRewardItem structure (camelCase)
            const processedReward: ProcessedRewardItem = {
                id: String(reward.reward_id), // Map backend ID to frontend ID
                reward_id: reward.reward_id, // Keep backend ID for clarity if needed
                name: reward.name,
                description: reward.description,
                image: reward.image_url || '/src/assets/reward_placeholder.png', // Map image_url to image
                type: reward.type,
                pointsCost: reward.points_cost, // Map points_cost
                discountPercentage: reward.discount_percentage, // Map
                discountFixedAmount: reward.discount_fixed_amount, // Map
                earningHint: reward.earning_hint, // Map earning_hint
                freeMenuItemIds: reward.free_menu_item_ids || [], // Ensure it's an array
                criteria: reward.criteria_json ? safeJsonParse(reward.criteria_json) : undefined, // Parse criteria_json
            };

            // Check eligibility using the raw reward definition and fetched customer data
            // checkRewardEligibility is designed to accept RawRewardItem
            const eligibilityResult = checkRewardEligibility(
                reward, // Pass the raw reward item
                customerInfo,
                claimedVoucherInstances,
                claimedGeneralRewardIds
            );

            // Combine processed reward with eligibility result
            return { ...processedReward, ...eligibilityResult };
        });

        setProcessedRewards(processed);

    }, [customerInfo, rewardsData]); // Depend on the fetched data

    // --- Filtering (remains the same) ---
    const filteredRewards = processedRewards
        // First filter out rewards that are ineligible and not claimed
        .filter(reward => 
            // Keep rewards that are:
            // 1. Eligible (Claim or ActiveVoucher status)
            // 2. Already claimed (Claimed status)
            // 3. If ineligible, only show if it's already claimed
            reward.currentStatus === 'Claim' || 
            reward.currentStatus === 'ActiveVoucher' || 
            reward.currentStatus === 'Claimed'
        )
        // Then apply the search filter
        .filter(reward => 
            reward.name.toLowerCase().includes(rewardSearchTerm.toLowerCase()) ||
            (reward.description && reward.description.toLowerCase().includes(rewardSearchTerm.toLowerCase()))
        );

     // --- Selection (remains the same) ---
     const handleSelectReward = (reward: ProcessedRewardItem) => {
        setSelectedReward(reward);
     };

     // --- Updated Claim Handler ---
     const handleClaimReward = async (rewardId: string, instanceId?: string) => {
        if (!user || !user.internalId) {
            alert("You must be logged in to claim rewards.");
            return;
        }

        // Find the processed reward from the state
        const rewardToClaim = processedRewards.find(r => r.id === rewardId);
        if (!rewardToClaim) {
            alert("Reward not found.");
            return;
        }

        // Enforce stricter eligibility checks
        if (rewardToClaim.currentStatus !== 'Claim' && rewardToClaim.currentStatus !== 'ActiveVoucher') {
            // Don't allow claiming if not in the right status
            const statusMessage = rewardToClaim.currentStatus === 'Claimed' 
                ? "This reward has already been claimed." 
                : `Cannot claim this reward. Status: ${rewardToClaim.currentStatus}`;
            alert(statusMessage);
            
            if (rewardToClaim.currentStatus === 'Ineligible' && rewardToClaim.progressMessage) {
                alert(`Reason: ${rewardToClaim.progressMessage}`);
            }
            return;
        }

        // Check points requirement
        if (rewardToClaim.pointsCost && !rewardToClaim.isVoucher && customerInfo) {
            if (customerInfo.loyaltyPoints < rewardToClaim.pointsCost) {
                alert(`You don't have enough points to claim this reward. Required: ${rewardToClaim.pointsCost}, Available: ${customerInfo.loyaltyPoints}`);
                return;
            }
            
            // Confirm before claiming points-based rewards
            if (!window.confirm(`Claim "${rewardToClaim.name}" for ${rewardToClaim.pointsCost} points?`)) {
                return;
            }
        }

        setIsClaiming(true);
        setClaimingRewardId(rewardId);
        setClaimingError(null);

        try {
          const token = localStorage.getItem('authToken');
          const headers: HeadersInit = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;

          // Determine endpoint and method based on reward type and instanceId
          let endpoint = '';
          let method = 'POST';
          let body = {};

          // Use processed type property
          if (rewardToClaim.type === 'voucher' && instanceId) {
            // Claiming a specific voucher instance (e.g., using it)
            endpoint = `http://localhost:3001/api/customers/${user.internalId}/vouchers/${instanceId}/claim`; // Endpoint to mark voucher as claimed
            method = 'PATCH'; // Or PUT depending on backend API design for marking as used
            // Body might be empty or contain usage details
          } else {
            // Claiming a reward definition (standard, loyalty tier, signup, referral)
            endpoint = `http://localhost:3001/api/customers/${user.internalId}/rewards/claim`;
            method = 'POST';
            // Send backend reward_id and make sure we're using the proper customer_id
            body = { 
              rewardId: rewardToClaim.reward_id,
              customerId: user.internalId // Explicitly include customer ID to ensure we're using the right one
            };
          }

          console.log(`[Rewards.tsx] Sending ${method} request to ${endpoint} with body:`, body);
          const response = await fetch(endpoint, {
              method: method,
              headers: headers,
              body: method === 'POST' || method === 'PUT' || method === 'PATCH' ? JSON.stringify(body) : undefined,
          });

          if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ message: 'Failed to claim reward. Server returned an error.' }));
            throw new Error(errorBody.message || `HTTP error! status: ${response.status}`);
          }

          // Assuming the backend responds with updated customer info or confirmation
          const result = await response.json();
          console.log('[Rewards.tsx] Claim successful. Result:', result);

          // Re-fetch data to update the UI with the latest customer points, vouchers, etc.
          const fetchDataAsync = async () => {
            setIsLoading(true);
            setError(null);
            setCustomerInfo(null); // Reset while fetching
            setRewardsData([]);
            setClaimedStatusOverrides({}); // Reset overrides
            setClaimedGeneralRewardIds([]); // Reset claimed general reward IDs

            try {
                const token = localStorage.getItem('authToken');
                const headers = { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };

                // Fetch Customer Info (includes active vouchers)
                const customerInfoResponse = await fetch(`http://localhost:3001/api/customers/${targetCustomerId}/info`, { headers });
                if (!customerInfoResponse.ok) throw new Error(`Failed to fetch customer info: ${customerInfoResponse.statusText}`);
                const customerData: CustomerInfo = await customerInfoResponse.json();
                setCustomerInfo(customerData);
                // Capture claimed general reward IDs from the response
                setClaimedGeneralRewardIds(customerData.claimedGeneralRewardIds || []);

                // Fetch Reward Definitions
                const rewardsResponse = await fetch('http://localhost:3001/api/rewards/definitions', { headers });
                if (!rewardsResponse.ok) throw new Error(`Failed to fetch reward definitions: ${rewardsResponse.statusText}`);
                const rewardDefs: RawRewardItem[] = await rewardsResponse.json();
                setRewardsData(rewardDefs);
            } catch (fetchError: any) {
                console.error("Error fetching rewards page data:", fetchError);
                setError(fetchError.message || "Failed to load rewards data.");
            } finally {
                setIsLoading(false);
            }
          };

          // Call the fetch function
          fetchDataAsync();

          alert(`Reward "${rewardToClaim.name}" claimed successfully!`);

        } catch (err: any) {
            console.error("Failed to claim reward:", err);
            setClaimingError(err.message || "An unexpected error occurred during claiming.");
        } finally {
            setIsClaiming(false);
            setClaimingRewardId(null);
        }
     };

    // --- getButtonProps (Updated to use isClaiming state) ---
    const getButtonProps = (reward: ProcessedRewardItem) => {
        const identifier = reward.isVoucher ? reward.instanceId : reward.id;
        if (isClaiming === identifier) {
             return { text: 'Claiming...', className: 'bg-gray-400 animate-pulse', disabled: true };
        }
        // Existing logic based on reward.currentStatus
        switch (reward.currentStatus) {
            case 'Claim':
            case 'ActiveVoucher': // Treat ActiveVoucher as Claimable
                 // Check points cost only for non-vouchers
                if (reward.pointsCost && !reward.isVoucher && customerInfo && customerInfo.loyaltyPoints < reward.pointsCost) {
                    return { text: `Need ${reward.pointsCost} Pts`, className: 'bg-yellow-500', disabled: true };
                }
                const text = reward.currentStatus === 'ActiveVoucher' ? 'Use Voucher' : 'Claim';
                const baseColor = reward.currentStatus === 'ActiveVoucher' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-green-600 hover:bg-green-700';
                return { text, className: baseColor, disabled: false };
            case 'Claimed':
                 return { text: 'Claimed', className: 'bg-blue-600', disabled: true };
            case 'Ineligible':
                return { text: 'Ineligible', className: 'bg-gray-400 cursor-not-allowed', disabled: true };
            default:
                return { text: 'Status Unknown', className: 'bg-gray-300', disabled: true };
        }
    };

  // --- Render Logic (Check for loading/error states first) ---
  if (isLoading) {
    return <div className="p-6">Loading rewards data...</div>;
  }
  if (error) {
    return <div className="p-6 text-red-500">Error: {error}</div>;
  }
  if (!customerInfo) { // Check if customerInfo failed to load
      return <div className="p-6 text-gray-500">Could not load customer information.</div>;
  }

  // Main Render (uses fetched customerInfo and processedRewards)
  return (
    <div className="flex gap-6 h-[calc(100vh-theme(space.24))]">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
             <h1 className="text-3xl font-semibold text-brown-900 mb-6">Rewards</h1>

            {/* Top Customer Info Banner - Uses fetched customerInfo */}
            <div className="bg-emerald-200 p-6 rounded-t-2xl flex items-center space-x-4 mb-6 shadow-sm border-b border-emerald-300">
                    <img src={customerInfo.avatar || '/src/assets/person.svg'} alt="Customer Avatar" className="w-12 h-12 object-contain bg-white rounded-full p-1" />
                 <div>
                    <h2 className="text-xl font-semibold text-gray-800">{customerInfo.name}</h2>
                        <p className="text-emerald-800 text-sm">ID: {customerInfo.id} {customerInfo.membershipTier && `| Tier: ${customerInfo.membershipTier}`}</p>
                        <p className="text-emerald-700 text-sm">Points: {customerInfo.loyaltyPoints}</p>
                 </div>
            </div>
            
             {/* All Rewards Section */}
             <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xl font-semibold text-brown-800">Available Rewards & Vouchers</h3>
                 <div className="relative w-64">
                      <input 
                         type="text" 
                         placeholder="Search for a reward" 
                         value={rewardSearchTerm}
                         onChange={(e) => setRewardSearchTerm(e.target.value)}
                         className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brown-400 text-sm"
                      />
                      <img src="/src/assets/search.svg" alt="Search" className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                 </div>
             </div>

             {/* Rewards Grid - Uses processedRewards, getButtonProps, handleClaimReward */} 
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5 overflow-y-auto pr-2 flex-1">
                {filteredRewards.map(reward => {
                    const buttonProps = getButtonProps(reward);
                    const identifier = reward.isVoucher ? reward.instanceId : reward.id;
                    return (
                         <div 
                            key={identifier} 
                            onClick={() => handleSelectReward(reward)}
                            className={`bg-white rounded-2xl p-4 shadow border hover:shadow-md transition-shadow cursor-pointer flex flex-col ${selectedReward?.id === reward.id && selectedReward?.instanceId === reward.instanceId ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-100'}`}>
                             <img src={reward.image || '/src/assets/rewards.png'} alt={reward.name} className="w-24 h-24 object-contain mx-auto mb-3" />
                             <h4 className="text-md font-semibold text-brown-900 mb-2 text-center flex-1">{reward.name} {reward.isVoucher && <span className="text-xs text-emerald-600 block">(Voucher)</span>}</h4>
                             <button 
                                onClick={(e) => {
                                     e.stopPropagation(); 
                                     if (reward.currentStatus === 'Claim' || reward.currentStatus === 'ActiveVoucher') {
                                         handleClaimReward(reward.id!, reward.instanceId);
                                     }
                                }}
                                className={`w-full py-2 rounded-lg text-white text-sm font-medium transition-colors ${buttonProps.className}`}
                                disabled={buttonProps.disabled || isClaiming === identifier} // Disable if claiming this specific one
                             >
                                {buttonProps.text}
                            </button>
                        </div>
                    );
                })}
                 {filteredRewards.length === 0 && (
                     <p className="text-gray-500 col-span-full text-center mt-10">No rewards found{rewardSearchTerm ? ` matching "${rewardSearchTerm}"` : ''}.</p>
                 )}
            </div>
        </div>

        {/* Right Sidebar - Uses selectedReward and customerInfo */} 
        <div className="w-80 bg-white rounded-2xl p-5 shadow flex flex-col border border-gray-100">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-brown-800">Reward details</h2>
                 <button 
                    onClick={() => setSelectedReward(null)}
                    title="Close Details"
                    className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200 transition-colors">
                     <img src="/src/assets/delete.svg" alt="Close Details" className="w-4 h-4" />
                </button>
            </div>

            {selectedReward && customerInfo ? (
                <>
                    <div className="mb-4 border-b border-gray-100 pb-4">
                        <p className="text-xs text-gray-500 mb-1">Customer</p>
                        <p className="font-medium text-gray-800">{customerInfo.name} <span className="text-gray-400 text-xs">(ID: {customerInfo.id})</span></p>
                    </div>

                     <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4 text-sm">
                        <div className="flex items-start gap-3 mb-3">
                             <img src={selectedReward.image || '/src/assets/rewards.png'} alt={selectedReward.name} className="w-12 h-12 object-contain bg-gray-50 rounded-md p-1 border"/>
                             <div className="flex-1">
                                 <p className="text-md font-medium text-gray-800">{selectedReward.name}</p>
                                 <p className={`text-sm font-medium ${selectedReward.currentStatus === 'Claim' || selectedReward.currentStatus === 'ActiveVoucher' ? 'text-green-600' : selectedReward.currentStatus === 'Claimed' ? 'text-blue-600' : 'text-gray-500'}`}>
                                    {selectedReward.currentStatus.replace('ActiveVoucher', 'Active Voucher')}
                                 </p>
                             </div>
                         </div>
                         
                         {selectedReward.description && <DetailItem label="Description" value={selectedReward.description} />}
                         <DetailItem label="Eligibility / Progress" value={selectedReward.progressMessage} />
                         {selectedReward.isVoucher && selectedReward.instanceId && <DetailItem label="Voucher ID" value={selectedReward.instanceId} />}
                         {selectedReward.pointsCost && !selectedReward.isVoucher && <DetailItem label="Cost to Redeem" value={`${selectedReward.pointsCost} points`} />}
                         {selectedReward.type && <DetailItem label="Reward Type" value={selectedReward.type.replace('manual_grant', 'Manually Granted').replace('discount_coupon', 'Discount').replace('loyalty_tier_perk', 'Tier Perk')} />}
                         {selectedReward.criteria?.minSpendPerTransaction && <DetailItem label="Min. Spend/Trans." value={`$${selectedReward.criteria.minSpendPerTransaction.toFixed(2)}`} />}
                         {selectedReward.criteria?.cumulativeSpendTotal && <DetailItem label="Total Spend Required" value={`$${selectedReward.criteria.cumulativeSpendTotal.toFixed(2)}`} />}
                     </div>

                     {/* Totals Section (may not apply for free rewards) */}
                     <div className="space-y-1 text-sm mb-4 border-t border-gray-100 pt-3">
                         <div className="flex justify-between text-gray-600">
                             <span>Subtotal</span>
                             <span>$0.00</span>
                         </div>
                         <div className="flex justify-between font-semibold text-lg text-brown-900 pt-1 border-t border-gray-200 mt-2">
                             <span>TOTAL</span>
                             <span>$0.00</span>
                         </div>
                     </div>

                     {/* Action Button - Updated onClick */}
                      {(() => {
                           const buttonProps = getButtonProps(selectedReward);
                           const identifier = selectedReward.isVoucher ? selectedReward.instanceId : selectedReward.id;
                           return (
                                <button 
                                    onClick={(e) => {
                                         e.stopPropagation();
                                         if (selectedReward.currentStatus === 'Claim' || selectedReward.currentStatus === 'ActiveVoucher') {
                                            handleClaimReward(selectedReward.id!, selectedReward.instanceId);
                                         }
                                    }}
                                    className={`w-full py-3 rounded-xl text-white font-semibold text-md transition-colors ${buttonProps.className}`}
                                    disabled={buttonProps.disabled || isClaiming === identifier}
                                >
                                    {isClaiming === identifier ? 'Processing...' : (selectedReward.currentStatus === 'Claim' ? 'Redeem Reward' : selectedReward.currentStatus === 'ActiveVoucher' ? 'Use Voucher' : buttonProps.text)}
                                </button>
                           );
                      })()}
                </> 
            ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400">
                     <img src="/src/assets/rewards.svg" alt="" className="w-16 h-16 mb-4 opacity-50" />
                    <p>Select a reward from the list to view its details.</p>
                </div>
            )}
        </div>
    </div>
  );
};

// Helper component (can be reused or defined locally)
const DetailItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div>
        <label className="block text-xs font-medium text-gray-500 mb-0.5">{label}</label>
        <p className="text-gray-800">{value}</p>
    </div>
);

// Helper to check if a reward is claimable (client-side check based on currentStatus)
const isRewardClaimable = (reward: ProcessedRewardItem) => {
  // Access processed camelCase property
  return reward.currentStatus === 'Claim';
};

export default Rewards; 