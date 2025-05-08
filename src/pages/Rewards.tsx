import React, { useState, useEffect } from 'react';
import { RawRewardItem, CustomerInfo, User, CustomerVoucher, RawRewardItemCriteria, TimeWindow } from '../types'; // Import types, added TimeWindow

// Define interface for Reward data AS DISPLAYED ON THIS PAGE (includes dynamic status)
interface ProcessedRewardItem extends RawRewardItem {
    currentStatus: 'Claim' | 'Claimed' | 'Ineligible' | 'ActiveVoucher'; 
    progressMessage: string;
    instanceId?: string; // For vouchers, to uniquely identify the claimed instance
    isVoucher?: boolean; // Flag to identify if this is from customerInfo.activeVouchers
}

// Props for the Rewards component
interface RewardsProps {
    rewardsData: RawRewardItem[];
    customerInfo: CustomerInfo;
    user: User | null; // Current logged-in user
    updateVoucherStatus: (voucherInstanceId: string, newStatus: 'claimed' | 'expired') => void; // Add this prop
    deductPoints: (customerId: string, pointsToDeduct: number) => void; // Add deductPoints prop
    claimedGeneralRewards: Set<string>; // Set of claimed general reward IDs for the current customer
    markGeneralRewardAsClaimed: (customerId: string, rewardId: string) => void; // Function to mark a general reward as claimed
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
    rewardsData, 
    customerInfo, 
    user, 
    updateVoucherStatus, 
    deductPoints, 
    claimedGeneralRewards, // New prop
    markGeneralRewardAsClaimed // New prop
}) => {
    // const [claimedVoucherInstanceIds, setClaimedVoucherInstanceIds] = useState(new Set<string>()); // No longer needed here for general claims
    const [processedRewards, setProcessedRewards] = useState<ProcessedRewardItem[]>([]);
    const [selectedReward, setSelectedReward] = useState<ProcessedRewardItem | null>(null);
    const [rewardSearchTerm, setRewardSearchTerm] = useState('');

    useEffect(() => {
        const allDisplayableRewards: ProcessedRewardItem[] = [];

        // 1. Process active vouchers from customerInfo
        if (customerInfo.activeVouchers) {
            customerInfo.activeVouchers.forEach(voucher => {
                const underlyingReward = rewardsData.find(r => r.id === voucher.rewardId);
                if (underlyingReward) {
                    const eligibility = checkRewardEligibility(underlyingReward, customerInfo, customerInfo.activeVouchers || [], claimedGeneralRewards, true, voucher);
                    const processedVoucher: ProcessedRewardItem = {
                        // Properties from RawRewardItem (underlyingReward)
                        id: underlyingReward.id,
                        name: voucher.name, // Override with voucher's name
                        description: voucher.description || underlyingReward.description, // Override with voucher's description if available
                        image: underlyingReward.image,
                        type: underlyingReward.type,
                        criteria: underlyingReward.criteria,
                        pointsCost: underlyingReward.pointsCost,
                        freeMenuItemIds: underlyingReward.freeMenuItemIds,
                        discountPercentage: underlyingReward.discountPercentage,
                        discountFixedAmount: underlyingReward.discountFixedAmount,
                        earningHint: underlyingReward.earningHint,
                        // Properties specific to ProcessedRewardItem or overridden
                        instanceId: voucher.instanceId,
                        isVoucher: true,
                        currentStatus: eligibility.currentStatus, // Explicitly from checkRewardEligibility
                        progressMessage: eligibility.progressMessage, // Explicitly from checkRewardEligibility
                    };
                    allDisplayableRewards.push(processedVoucher);
                }
            });
        }

        // 2. Process general rewardsData, avoiding duplicates if already shown as an active voucher
        rewardsData.forEach(reward => {
            if (!allDisplayableRewards.some(pr => pr.id === reward.id && pr.isVoucher)) {
                const eligibility = checkRewardEligibility(reward, customerInfo, customerInfo.activeVouchers || [], claimedGeneralRewards);
                const processedGeneralReward: ProcessedRewardItem = {
                    // Properties from RawRewardItem (reward)
                    id: reward.id,
                    name: reward.name,
                    description: reward.description,
                    image: reward.image,
                    type: reward.type,
                    criteria: reward.criteria,
                    pointsCost: reward.pointsCost,
                    freeMenuItemIds: reward.freeMenuItemIds,
                    discountPercentage: reward.discountPercentage,
                    discountFixedAmount: reward.discountFixedAmount,
                    earningHint: reward.earningHint,
                    // Properties specific to ProcessedRewardItem or overridden
                    isVoucher: false,
                    currentStatus: eligibility.currentStatus, // Explicitly from checkRewardEligibility
                    progressMessage: eligibility.progressMessage, // Explicitly from checkRewardEligibility
                    // instanceId will be undefined here, which is fine for ProcessedRewardItem
                };
                allDisplayableRewards.push(processedGeneralReward);
            }
        });
        
        // Deduplication logic (ensure it preserves ProcessedRewardItem type)
        const uniqueRewards = allDisplayableRewards.reduce((acc, current) => {
            const existingIndex = acc.findIndex(item => item.id === current.id);
            if (existingIndex !== -1) {
                // If current is a voucher and existing is not, replace existing with current.
                if (current.isVoucher && !acc[existingIndex].isVoucher) {
                    acc[existingIndex] = current;
                }
                // If both are vouchers, you might have more complex logic, but for now, first one wins or current replaces if preferred.
                // For simplicity, if IDs match and one is a voucher, we prioritize the voucher version if `current` is it.
                // Or, if types are same, current can overwrite (or not, depending on desired behavior)
            } else {
                acc.push(current);
            }
            return acc;
        }, [] as ProcessedRewardItem[]);

        // Re-check claimed status for general rewards based on the new prop, after merging vouchers
        const finalProcessedRewards = uniqueRewards.map((rewardItem): ProcessedRewardItem => { // Explicitly type rewardItem and return type
            if (!rewardItem.isVoucher && claimedGeneralRewards.has(rewardItem.id)) {
                return {
                    ...rewardItem,
                    currentStatus: 'Claimed', // This is a valid literal type
                    progressMessage: 'You have already claimed this reward.'
                };
            }
            return rewardItem; // rewardItem here is already ProcessedRewardItem
        });

        setProcessedRewards(finalProcessedRewards);
    }, [rewardsData, customerInfo, claimedGeneralRewards, user]);

    const filteredRewards = processedRewards.filter(reward => 
        reward.name.toLowerCase().includes(rewardSearchTerm.toLowerCase()) ||
        (reward.description && reward.description.toLowerCase().includes(rewardSearchTerm.toLowerCase()))
    );

     const handleSelectReward = (reward: ProcessedRewardItem) => {
        setSelectedReward(reward);
     };

     const handleClaimReward = (rewardId: string, instanceId?: string) => {
        // SECURITY NOTE: This function initiates a claim process that is currently client-side.
        // All actions (point deduction, marking as claimed, updating voucher status) MUST be 
        // securely processed and validated by the backend via API calls triggered by 
        // updateVoucherStatus, deductPoints, or markGeneralRewardAsClaimed props.

        const rewardToClaim = processedRewards.find(r => r.isVoucher ? r.instanceId === instanceId : r.id === rewardId);

        if (rewardToClaim && rewardToClaim.currentStatus === 'Claim') {
            const targetCustomerId = customerInfo.id; // Get customer ID from props

            if (rewardToClaim.isVoucher && instanceId) {
                // Claiming a specific voucher instance
                updateVoucherStatus(instanceId, 'claimed');
                alert(`Voucher "${rewardToClaim.name}" used!`);
                // Optional: Update local claimed state if needed for immediate UI feedback before re-render
                // setClaimedVoucherInstanceIds(prevIds => new Set(prevIds).add(instanceId)); // This was for voucher instances, parent now manages claimed status of vouchers via updateVoucherStatus

            } else if (!rewardToClaim.isVoucher) {
                // Claiming a general reward (not a pre-existing voucher)
                const commonClaimAction = () => {
                    markGeneralRewardAsClaimed(targetCustomerId, rewardToClaim.id);
                    alert(`Redeemed "${rewardToClaim.name}"! Details: ${rewardToClaim.pointsCost ? rewardToClaim.pointsCost + ' points deducted.' : 'No points cost.'}`);
                };

                if (rewardToClaim.pointsCost) {
                    // Reward costs points
                    if (customerInfo.loyaltyPoints >= rewardToClaim.pointsCost) {
                        deductPoints(targetCustomerId, rewardToClaim.pointsCost);
                        commonClaimAction();
                    } else {
                        alert('Not enough points to redeem.');
                        return; // Stop claim process
                    }
                } else {
                    // Claiming a general reward that doesn't cost points (e.g., birthday reward)
                    commonClaimAction();
                }
                // Removed: setClaimedVoucherInstanceIds(prevIds => new Set(prevIds).add(rewardId + '_generalclaim_'));
            }
            // Deselect reward after successful claim attempt
            setSelectedReward(null);
        } else {
            alert("Cannot claim this reward at this time.");
        }
     };

    const getButtonProps = (reward: ProcessedRewardItem) => {
        switch (reward.currentStatus) {
            case 'Claim':
                // Add check for pointsCost if applicable
                if (reward.pointsCost && customerInfo.loyaltyPoints < reward.pointsCost && !reward.isVoucher) {
                    return { text: `Need ${reward.pointsCost} Pts`, className: 'bg-yellow-500', disabled: true };
                }
                return { text: 'Claim', className: 'bg-green-600 hover:bg-green-700', disabled: false };
            case 'Claimed':
                 return { text: 'Claimed', className: 'bg-blue-600', disabled: true };
            case 'Ineligible':
            case 'ActiveVoucher': // ActiveVoucher implies it's claimable if all other conditions met
                if(reward.currentStatus === 'ActiveVoucher') return { text: 'Use Voucher', className: 'bg-emerald-600 hover:bg-emerald-700', disabled: false };
                return { text: 'Ineligible', className: 'bg-gray-400 cursor-not-allowed', disabled: true };
            default:
                return { text: 'Status Unknown', className: 'bg-gray-300', disabled: true };
        }
    };

  return (
    <div className="flex gap-6 h-[calc(100vh-theme(space.24))]">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
             <h1 className="text-3xl font-semibold text-brown-900 mb-6">Rewards</h1>

            {/* Top Customer Info Banner - Changed background, aligned content left */}
            {user && (
            <div className="bg-emerald-200 p-6 rounded-t-2xl flex items-center space-x-4 mb-6 shadow-sm border-b border-emerald-300">
                    <img src={customerInfo.avatar || '/src/assets/person.svg'} alt="Customer Avatar" className="w-12 h-12 object-contain bg-white rounded-full p-1" />
                 <div>
                    <h2 className="text-xl font-semibold text-gray-800">{customerInfo.name}</h2>
                        <p className="text-emerald-800 text-sm">ID: {customerInfo.id} {customerInfo.membershipTier && `| Tier: ${customerInfo.membershipTier}`}</p>
                        <p className="text-emerald-700 text-sm">Points: {customerInfo.loyaltyPoints}</p>
                 </div>
            </div>
            )}
            
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

             {/* Rewards Grid */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5 overflow-y-auto pr-2 flex-1">
                {filteredRewards.map(reward => {
                    const buttonProps = getButtonProps(reward);
                    return (
                         <div 
                            key={reward.isVoucher ? reward.instanceId : reward.id} 
                            onClick={() => handleSelectReward(reward)}
                            className={`bg-white rounded-2xl p-4 shadow border hover:shadow-md transition-shadow cursor-pointer flex flex-col ${selectedReward?.id === reward.id && selectedReward?.instanceId === reward.instanceId ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-100'}`}>
                             <img src={reward.image} alt={reward.name} className="w-24 h-24 object-contain mx-auto mb-3" />
                             <h4 className="text-md font-semibold text-brown-900 mb-2 text-center flex-1">{reward.name} {reward.isVoucher && <span className="text-xs text-emerald-600 block">(Voucher)</span>}</h4>
                             <button 
                                onClick={(e) => {
                                     e.stopPropagation(); // Prevent card selection when clicking button
                                     if (reward.currentStatus === 'Claim' || reward.currentStatus === 'ActiveVoucher') handleClaimReward(reward.id, reward.instanceId);
                                }}
                                className={`w-full py-2 rounded-lg text-white text-sm font-medium transition-colors ${buttonProps.className}`}
                                disabled={buttonProps.disabled}
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

        {/* Right Sidebar - Reward Details */}
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

            {selectedReward ? (
                <>
                    <div className="mb-4 border-b border-gray-100 pb-4">
                        <p className="text-xs text-gray-500 mb-1">Customer</p>
                        <p className="font-medium text-gray-800">{customerInfo.name} <span className="text-gray-400 text-xs">(ID: {customerInfo.id})</span></p>
                    </div>

                     <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4 text-sm">
                        <div className="flex items-start gap-3 mb-3">
                             <img src={selectedReward.image} alt={selectedReward.name} className="w-12 h-12 object-contain bg-gray-50 rounded-md p-1 border"/>
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

                     {/* Action Button */}
                      {(() => {
                           const buttonProps = getButtonProps(selectedReward);
                           return (
                                <button 
                                    onClick={() => {
                                         if (selectedReward.currentStatus === 'Claim' || selectedReward.currentStatus === 'ActiveVoucher') handleClaimReward(selectedReward.id, selectedReward.instanceId);
                                    }}
                                    className={`w-full py-3 rounded-xl text-white font-semibold text-md transition-colors ${buttonProps.className}`}
                                    disabled={buttonProps.disabled}
                                >
                                    {selectedReward.currentStatus === 'Claim' ? 'Redeem Reward' : selectedReward.currentStatus === 'ActiveVoucher' ? 'Use Voucher' : buttonProps.text}
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

export default Rewards; 