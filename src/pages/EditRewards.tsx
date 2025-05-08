import React, { useState, useEffect, useReducer } from 'react';
import { RawRewardItem, User, RawRewardItemCriteria, TimeWindow } from '../types'; // Import the shared type from ../types.ts

interface EditRewardsProps {
  rewardsData: RawRewardItem[];
  onAddReward: (newReward: Omit<RawRewardItem, 'id'>) => void;
  onUpdateReward: (updatedReward: RawRewardItem) => void;
  onDeleteReward: (rewardId: string) => void;
  grantVoucherFunction: (customerId: string, rewardId: string, grantedByEmployeeId: string, notes?: string) => void;
  loggedInUser: User | null;
}

// --- Step 2: Define State Shape for Reducer ---
interface RewardFormState {
  name: string;
  image: string;
  type: RawRewardItem['type'];
  description: string;
  pointsCost: string;
  freeMenuItemIds: string; // Comma-separated
  discountPercentage: string;
  discountFixedAmount: string;
  earningHint: string;
  // Criteria fields
  criteria_minSpend: string;
  criteria_minPoints: string;
  criteria_requiredProductIds: string;
  criteria_excludedProductIds: string;
  criteria_isBirthMonthOnly: boolean;
  criteria_isBirthdayOnly: boolean; 
  criteria_minPurchasesMonthly: string;
  criteria_allowedDaysOfWeek: string;
  criteria_activeTimeWindows: string;
  criteria_requiredCustomerTier: string;
  criteria_isSignUpBonus: boolean;
  criteria_isReferralBonusForNewUser: boolean;
  criteria_isRewardForReferringUser: boolean;
  criteria_minReferrals: string; 
  criteria_validStartDate: string; 
  criteria_validEndDate: string;   
  criteria_cumulativeSpendTotal: string; 
  criteria_minSpendPerTransaction: string; 
  criteria_requiresSpecificProductIds: string;
  criteria_requiresProductCategory: string; 
}

// --- Step 3: Define Action Types ---
type FormAction = 
  | { type: 'SET_FIELD'; field: keyof RewardFormState; value: string | boolean }
  | { type: 'LOAD_REWARD'; payload: RawRewardItem }
  | { type: 'RESET_FORM' };

// --- Helper Function to Map RawRewardItem to Form State ---
const mapRewardToFormState = (reward: RawRewardItem): RewardFormState => {
  return {
    name: reward.name || '',
    image: reward.image || '',
    type: reward.type || 'standard',
    description: reward.description || '',
    pointsCost: reward.pointsCost?.toString() || '',
    freeMenuItemIds: reward.freeMenuItemIds?.join(', ') || '',
    discountPercentage: reward.discountPercentage?.toString() || '',
    discountFixedAmount: reward.discountFixedAmount?.toString() || '',
    earningHint: reward.earningHint || '',
    criteria_minSpend: reward.criteria?.minSpend?.toString() || '',
    criteria_minPoints: reward.criteria?.minPoints?.toString() || '',
    criteria_requiredProductIds: reward.criteria?.requiredProductIds?.join(', ') || '',
    criteria_excludedProductIds: reward.criteria?.excludedProductIds?.join(', ') || '',
    criteria_isBirthMonthOnly: reward.criteria?.isBirthMonthOnly || false,
    criteria_isBirthdayOnly: reward.criteria?.isBirthdayOnly || false,
    criteria_minPurchasesMonthly: reward.criteria?.minPurchasesMonthly?.toString() || '',
    criteria_allowedDaysOfWeek: reward.criteria?.allowedDaysOfWeek?.join(', ') || '',
    criteria_activeTimeWindows: reward.criteria?.activeTimeWindows ? JSON.stringify(reward.criteria.activeTimeWindows, null, 2) : '',
    criteria_requiredCustomerTier: reward.criteria?.requiredCustomerTier?.join(', ') || '',
    criteria_isSignUpBonus: reward.criteria?.isSignUpBonus || false,
    criteria_isReferralBonusForNewUser: reward.criteria?.isReferralBonusForNewUser || false,
    criteria_isRewardForReferringUser: reward.criteria?.isRewardForReferringUser || false,
    criteria_minReferrals: reward.criteria?.minReferrals?.toString() || '',
    criteria_validStartDate: reward.criteria?.validDateRange?.startDate || '',
    criteria_validEndDate: reward.criteria?.validDateRange?.endDate || '',
    criteria_cumulativeSpendTotal: reward.criteria?.cumulativeSpendTotal?.toString() || '',
    criteria_minSpendPerTransaction: reward.criteria?.minSpendPerTransaction?.toString() || '',
    criteria_requiresSpecificProductIds: reward.criteria?.requiresSpecificProductIds?.join(', ') || '',
    criteria_requiresProductCategory: reward.criteria?.requiresProductCategory || '',
  };
};

// --- Initial State for Reducer ---
const initialFormState: RewardFormState = mapRewardToFormState({} as RawRewardItem); // Start empty by mapping an empty object

// --- Step 4: Implement the Reducer Function ---
function formReducer(state: RewardFormState, action: FormAction): RewardFormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'LOAD_REWARD':
      return mapRewardToFormState(action.payload);
    case 'RESET_FORM':
      return initialFormState;
    default:
      return state;
  }
}

const EditRewards: React.FC<EditRewardsProps> = ({ 
  rewardsData,
  onAddReward,
  onUpdateReward,
  onDeleteReward,
  grantVoucherFunction,
  loggedInUser
}) => {

  // --- Step 6: Replace useState with useReducer ---
  const [formState, dispatch] = useReducer(formReducer, initialFormState);
  const [editingReward, setEditingReward] = useState<RawRewardItem | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // --- Grant Voucher State (remains useState) ---
  const [grantCustomerId, setGrantCustomerId] = useState('');
  const [grantRewardId, setGrantRewardId] = useState<string>('');
  const [grantNotes, setGrantNotes] = useState('');
  const [grantError, setGrantError] = useState<string | null>(null);

  // --- Step 7: Update Event Handlers ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    dispatch({
      type: 'SET_FIELD',
      field: name as keyof RewardFormState,
      value: isCheckbox ? (e.target as HTMLInputElement).checked : value
    });
  };

  // --- Update Form Population/Reset ---
  const handleStartEdit = (reward: RawRewardItem) => {
    setEditingReward(reward);
    dispatch({ type: 'LOAD_REWARD', payload: reward });
    setFormErrors({}); // Clear errors when starting edit
  };

  const handleCancelEdit = () => {
    setEditingReward(null);
    dispatch({ type: 'RESET_FORM' });
    setFormErrors({});
  };
  
  // Renamed helper, now just resets editing state and dispatches to reducer
  const resetFormAndEditingState = () => {
    setEditingReward(null);
    dispatch({ type: 'RESET_FORM' });
    setFormErrors({});
  };

  // Validate form (reads from formState)
  const validateForm = (): boolean => { 
      const errors: Record<string, string> = {};
      if (!formState.name.trim()) errors.name = 'Reward name is required.';
      if (!formState.type) errors.type = 'Reward type is required.';
      
      // Enhanced validation examples (can be expanded)
      const numberFields: (keyof RewardFormState)[] = ['pointsCost', 'discountPercentage', 'discountFixedAmount', 'criteria_minSpend', 'criteria_minPoints', 'criteria_minPurchasesMonthly', 'criteria_minReferrals', 'criteria_cumulativeSpendTotal', 'criteria_minSpendPerTransaction'];
      numberFields.forEach(field => {
          if (formState[field] && isNaN(Number(formState[field]))) {
              errors[field] = `${field} must be a valid number.`;
          }
      });

      const commaSeparatedIdFields: (keyof RewardFormState)[] = ['freeMenuItemIds', 'criteria_requiredProductIds', 'criteria_excludedProductIds', 'criteria_requiresSpecificProductIds'];
      commaSeparatedIdFields.forEach(field => {
          const value = formState[field];
          if (typeof value === 'string') {
            // Only test if value is a non-empty string
            if (value.trim() && !/^[\w\s,-]*$/.test(value)) { 
               errors[field] = `${field} should be comma-separated IDs (letters, numbers, -, _).`;
            }
          } else if (value !== undefined && value !== null && typeof value !== 'boolean') {
            // This case handles if `value` is something other than string/boolean/undefined/null, which is unexpected.
            errors[field] = `${field} has an unexpected type. Expected a comma-separated string.`;
          } else if (typeof value === 'boolean' && value === true) {
            // Explicitly handle if a boolean true was somehow set for these string fields
            errors[field] = `${field} is incorrectly set as a boolean. Expected a comma-separated string.`;
          }
      });
       if (formState.criteria_allowedDaysOfWeek && typeof formState.criteria_allowedDaysOfWeek === 'string' && formState.criteria_allowedDaysOfWeek.trim() && !/^[0-6\s,]*$/.test(formState.criteria_allowedDaysOfWeek)) {
           errors.criteria_allowedDaysOfWeek = 'Allowed Days must be comma-separated numbers (0-6).';
       }

      try {
        if (formState.criteria_activeTimeWindows.trim()) JSON.parse(formState.criteria_activeTimeWindows.trim());
      } catch (e) {
        errors.criteria_activeTimeWindows = 'Active Time Windows must be valid JSON or empty.';
      }
      setFormErrors(errors);
      return Object.keys(errors).length === 0; 
  };

  // REMOVED prepareCriteriaObject - logic moved into submission handlers

  // --- Step 8: Update Form Submission Logic ---
  const handleAddNewReward = () => {
    if (!validateForm()) return;
    
    const builtCriteria: Partial<RawRewardItemCriteria> = {};

    // Numbers
    if (formState.criteria_minSpend && !isNaN(parseFloat(formState.criteria_minSpend))) builtCriteria.minSpend = parseFloat(formState.criteria_minSpend);
    if (formState.criteria_minPoints && !isNaN(parseInt(formState.criteria_minPoints))) builtCriteria.minPoints = parseInt(formState.criteria_minPoints);
    if (formState.criteria_minPurchasesMonthly && !isNaN(parseInt(formState.criteria_minPurchasesMonthly))) builtCriteria.minPurchasesMonthly = parseInt(formState.criteria_minPurchasesMonthly);
    if (formState.criteria_minReferrals && !isNaN(parseInt(formState.criteria_minReferrals))) builtCriteria.minReferrals = parseInt(formState.criteria_minReferrals);
    if (formState.criteria_cumulativeSpendTotal && !isNaN(parseFloat(formState.criteria_cumulativeSpendTotal))) builtCriteria.cumulativeSpendTotal = parseFloat(formState.criteria_cumulativeSpendTotal);
    if (formState.criteria_minSpendPerTransaction && !isNaN(parseFloat(formState.criteria_minSpendPerTransaction))) builtCriteria.minSpendPerTransaction = parseFloat(formState.criteria_minSpendPerTransaction);

    // String arrays from comma-separated strings
    const parseStringArray = (str: string) => str.split(',').map(s => s.trim()).filter(Boolean);
    if (formState.criteria_requiredProductIds) builtCriteria.requiredProductIds = parseStringArray(formState.criteria_requiredProductIds);
    if (formState.criteria_excludedProductIds) builtCriteria.excludedProductIds = parseStringArray(formState.criteria_excludedProductIds);
    if (formState.criteria_requiresSpecificProductIds) builtCriteria.requiresSpecificProductIds = parseStringArray(formState.criteria_requiresSpecificProductIds);
    if (formState.criteria_requiredCustomerTier) builtCriteria.requiredCustomerTier = parseStringArray(formState.criteria_requiredCustomerTier);
    if (formState.criteria_allowedDaysOfWeek) {
        const days = formState.criteria_allowedDaysOfWeek.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 0 && n <= 6);
        if (days.length > 0) builtCriteria.allowedDaysOfWeek = days;
    }

    // Simple strings
    if (formState.criteria_requiresProductCategory && formState.criteria_requiresProductCategory.trim()) builtCriteria.requiresProductCategory = formState.criteria_requiresProductCategory.trim();

    // Booleans (only include if true, as per RawRewardItemCriteria definition)
    if (formState.criteria_isBirthMonthOnly) builtCriteria.isBirthMonthOnly = true;
    if (formState.criteria_isBirthdayOnly) builtCriteria.isBirthdayOnly = true;
    if (formState.criteria_isSignUpBonus) builtCriteria.isSignUpBonus = true;
    if (formState.criteria_isReferralBonusForNewUser) builtCriteria.isReferralBonusForNewUser = true;
    if (formState.criteria_isRewardForReferringUser) builtCriteria.isRewardForReferringUser = true;

    // Complex types
    if (formState.criteria_activeTimeWindows && formState.criteria_activeTimeWindows.trim()) {
        try {
            const parsed = JSON.parse(formState.criteria_activeTimeWindows.trim());
            if (Array.isArray(parsed) && parsed.length > 0) { // Add more validation for TimeWindow structure if needed
                builtCriteria.activeTimeWindows = parsed as TimeWindow[];
            }
        } catch (e) { /* Error handled by validateForm */ }
    }
    if (formState.criteria_validStartDate || formState.criteria_validEndDate) {
        const startDate = formState.criteria_validStartDate.trim() || undefined;
        const endDate = formState.criteria_validEndDate.trim() || undefined;
        if(startDate || endDate) builtCriteria.validDateRange = { startDate, endDate };
    }
    
    const finalCriteria = Object.keys(builtCriteria).length > 0 ? builtCriteria as RawRewardItemCriteria : undefined;

    const newReward: Omit<RawRewardItem, 'id'> = {
      name: formState.name.trim(),
      image: formState.image.trim(),
      type: formState.type,
      description: formState.description.trim() || undefined,
      criteria: finalCriteria,
      pointsCost: formState.pointsCost && !isNaN(parseInt(formState.pointsCost)) ? parseInt(formState.pointsCost) : undefined,
      freeMenuItemIds: formState.freeMenuItemIds && formState.freeMenuItemIds.trim() ? parseStringArray(formState.freeMenuItemIds) : undefined,
      discountPercentage: formState.discountPercentage && !isNaN(parseInt(formState.discountPercentage)) ? parseInt(formState.discountPercentage) : undefined,
      discountFixedAmount: formState.discountFixedAmount && !isNaN(parseFloat(formState.discountFixedAmount)) ? parseFloat(formState.discountFixedAmount) : undefined,
      earningHint: formState.earningHint.trim() || undefined,
    };

    console.log("Adding Reward:", newReward); 
    onAddReward(newReward);
    resetFormAndEditingState();
  };

  const handleUpdateReward = () => {
    if (!editingReward || !validateForm()) return;

    const builtCriteria: Partial<RawRewardItemCriteria> = {};
    // (Repeat the exact same logic for builtCriteria as in handleAddNewReward)
    // Numbers
    if (formState.criteria_minSpend && !isNaN(parseFloat(formState.criteria_minSpend))) builtCriteria.minSpend = parseFloat(formState.criteria_minSpend);
    if (formState.criteria_minPoints && !isNaN(parseInt(formState.criteria_minPoints))) builtCriteria.minPoints = parseInt(formState.criteria_minPoints);
    if (formState.criteria_minPurchasesMonthly && !isNaN(parseInt(formState.criteria_minPurchasesMonthly))) builtCriteria.minPurchasesMonthly = parseInt(formState.criteria_minPurchasesMonthly);
    if (formState.criteria_minReferrals && !isNaN(parseInt(formState.criteria_minReferrals))) builtCriteria.minReferrals = parseInt(formState.criteria_minReferrals);
    if (formState.criteria_cumulativeSpendTotal && !isNaN(parseFloat(formState.criteria_cumulativeSpendTotal))) builtCriteria.cumulativeSpendTotal = parseFloat(formState.criteria_cumulativeSpendTotal);
    if (formState.criteria_minSpendPerTransaction && !isNaN(parseFloat(formState.criteria_minSpendPerTransaction))) builtCriteria.minSpendPerTransaction = parseFloat(formState.criteria_minSpendPerTransaction);
    // String arrays
    const parseStringArray = (str: string) => str.split(',').map(s => s.trim()).filter(Boolean);
    if (formState.criteria_requiredProductIds) builtCriteria.requiredProductIds = parseStringArray(formState.criteria_requiredProductIds);
    if (formState.criteria_excludedProductIds) builtCriteria.excludedProductIds = parseStringArray(formState.criteria_excludedProductIds);
    if (formState.criteria_requiresSpecificProductIds) builtCriteria.requiresSpecificProductIds = parseStringArray(formState.criteria_requiresSpecificProductIds);
    if (formState.criteria_requiredCustomerTier) builtCriteria.requiredCustomerTier = parseStringArray(formState.criteria_requiredCustomerTier);
    if (formState.criteria_allowedDaysOfWeek) { const days = formState.criteria_allowedDaysOfWeek.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= 0 && n <= 6); if (days.length > 0) builtCriteria.allowedDaysOfWeek = days; }
    // Simple strings
    if (formState.criteria_requiresProductCategory && formState.criteria_requiresProductCategory.trim()) builtCriteria.requiresProductCategory = formState.criteria_requiresProductCategory.trim();
    // Booleans
    if (formState.criteria_isBirthMonthOnly) builtCriteria.isBirthMonthOnly = true;
    if (formState.criteria_isBirthdayOnly) builtCriteria.isBirthdayOnly = true;
    if (formState.criteria_isSignUpBonus) builtCriteria.isSignUpBonus = true;
    if (formState.criteria_isReferralBonusForNewUser) builtCriteria.isReferralBonusForNewUser = true;
    if (formState.criteria_isRewardForReferringUser) builtCriteria.isRewardForReferringUser = true;
    // Complex types
    if (formState.criteria_activeTimeWindows && formState.criteria_activeTimeWindows.trim()) { try { const parsed = JSON.parse(formState.criteria_activeTimeWindows.trim()); if (Array.isArray(parsed) && parsed.length > 0) { builtCriteria.activeTimeWindows = parsed as TimeWindow[]; } } catch (e) { /* Handled */ } }
    if (formState.criteria_validStartDate || formState.criteria_validEndDate) { const startDate = formState.criteria_validStartDate.trim() || undefined; const endDate = formState.criteria_validEndDate.trim() || undefined; if(startDate || endDate) builtCriteria.validDateRange = { startDate, endDate }; }

    const finalCriteria = Object.keys(builtCriteria).length > 0 ? builtCriteria as RawRewardItemCriteria : undefined;

    const updatedReward: RawRewardItem = {
      ...editingReward,
      name: formState.name.trim(), 
      image: formState.image.trim(), 
      type: formState.type,
      description: formState.description.trim() || undefined,
      criteria: finalCriteria,
      pointsCost: formState.pointsCost && !isNaN(parseInt(formState.pointsCost)) ? parseInt(formState.pointsCost) : undefined,
      freeMenuItemIds: formState.freeMenuItemIds && formState.freeMenuItemIds.trim() ? parseStringArray(formState.freeMenuItemIds) : undefined,
      discountPercentage: formState.discountPercentage && !isNaN(parseInt(formState.discountPercentage)) ? parseInt(formState.discountPercentage) : undefined,
      discountFixedAmount: formState.discountFixedAmount && !isNaN(parseFloat(formState.discountFixedAmount)) ? parseFloat(formState.discountFixedAmount) : undefined,
      earningHint: formState.earningHint.trim() || undefined,
    };

    console.log("Updating Reward:", updatedReward);
    onUpdateReward(updatedReward);
    resetFormAndEditingState();
  };

  // Grant Voucher handler remains the same
  const handleGrantVoucher = () => {
     // SECURITY NOTE: Backend MUST validate customerId, rewardId, and user permissions before granting the voucher.
     setGrantError(null); 
     if (!grantCustomerId.trim()) {
       setGrantError('Customer ID is required.'); return;
     }
     if (!grantRewardId) {
       setGrantError('Please select a reward to grant.'); return;
     }
     if (!loggedInUser) {
       setGrantError('Cannot grant voucher: logged in user not found.'); return;
     }
     grantVoucherFunction(grantCustomerId.trim(), grantRewardId, loggedInUser.id, grantNotes.trim());
     alert(`Voucher grant attempt for ${grantRewardId} to ${grantCustomerId}. Check console/app state.`);
     // Reset grant form
     setGrantCustomerId('');
     setGrantRewardId('');
     setGrantNotes('');
  };

  // useEffect and grantableRewards filter remain the same
  useEffect(() => {
    if (grantRewardId && !rewardsData.find(r => r.id === grantRewardId)) {
      setGrantRewardId(''); // Reset if selected reward is removed
    }
  }, [rewardsData, grantRewardId]);

  const grantableRewards = rewardsData.filter(r => r.type === 'manual_grant' || r.type === 'voucher');

  // --- Update JSX to use formState and dispatch --- 
  return (
    <div className="p-6 bg-stone-50 min-h-screen">
      <h2 className="text-2xl font-semibold text-stone-800 mb-6">Manage Rewards</h2>

      {/* Add/Edit Reward Form Section */}
      <div className="bg-white p-6 rounded-2xl shadow-lg mb-8">
        <h3 className="text-xl font-semibold text-stone-700 mb-4">
          {editingReward ? 'Edit Reward' : 'Add New Reward'}
        </h3>
        
        {/* Display Validation Errors (no change needed) */}
        {Object.keys(formErrors).length > 0 && ( 
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-700">Please correct the following errors:</p>
                <ul className="list-disc list-inside text-xs text-red-600">
                {Object.values(formErrors).map((error, index) => (
                    <li key={index}>{error}</li>
                ))}
                </ul>
            </div>
         )}

        {/* --- Basic Info --- (Update value and onChange) */} 
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 border-b pb-4">
          <FormGroup label="Name*">
            <input type="text" name="name" value={formState.name} onChange={handleInputChange} className={`form-input ${formErrors.name ? 'border-red-500' : ''}`} required />
          </FormGroup>
          <FormGroup label="Type*">
            <select name="type" value={formState.type} onChange={handleInputChange} className={`form-select ${formErrors.type ? 'border-red-500' : ''}`} required>
              <option value="standard">Standard</option>
              <option value="voucher">Voucher</option>
              <option value="discount_coupon">Discount Coupon</option>
              <option value="loyalty_tier_perk">Loyalty Tier Perk</option>
              <option value="manual_grant">Manual Grant Only</option>
            </select>
          </FormGroup>
          <FormGroup label="Image URL">
            <input type="text" name="image" value={formState.image} onChange={handleInputChange} className="form-input" />
          </FormGroup>
          <FormGroup label="Description" className="md:col-span-3">
            <textarea name="description" value={formState.description} onChange={handleInputChange} className="form-input h-16" />
          </FormGroup>
        </div>

        {/* --- Reward Effect --- (Update value and onChange) */} 
        <h3 className="text-lg font-medium text-gray-700 mb-2">Reward Effect (What it Gives)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 border-b pb-4">
          <FormGroup label="Points Cost (to claim)">
            <input type="number" name="pointsCost" value={formState.pointsCost} onChange={handleInputChange} className={`form-input ${formErrors.pointsCost ? 'border-red-500' : ''}`} min="0" />
          </FormGroup>
          <FormGroup label="Discount %">
            <input type="number" name="discountPercentage" value={formState.discountPercentage} onChange={handleInputChange} className={`form-input ${formErrors.discountPercentage ? 'border-red-500' : ''}`} min="0" max="100" />
          </FormGroup>
          <FormGroup label="Discount Fixed Amount ($)">
            <input type="number" name="discountFixedAmount" value={formState.discountFixedAmount} onChange={handleInputChange} className={`form-input ${formErrors.discountFixedAmount ? 'border-red-500' : ''}`} min="0" step="0.01" />
          </FormGroup>
          <FormGroup label="Free Menu Item IDs (comma-sep)" className="md:col-span-3">
            <input type="text" name="freeMenuItemIds" value={formState.freeMenuItemIds} onChange={handleInputChange} className={`form-input ${formErrors.freeMenuItemIds ? 'border-red-500' : ''}`} placeholder="e.g., latte-std, croissant-choc" />
          </FormGroup>
        </div>

        {/* --- Eligibility Criteria --- (Update value and onChange) */} 
        <h3 className="text-lg font-medium text-gray-700 mb-2">Eligibility Criteria (How to Earn/Qualify)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 border-b pb-4">
          <FormGroup label="Min. Points Required">
            <input type="number" name="criteria_minPoints" value={formState.criteria_minPoints} onChange={handleInputChange} className={`form-input ${formErrors.criteria_minPoints ? 'border-red-500' : ''}`} min="1" />
          </FormGroup>
          <FormGroup label="Min. Spend / Transaction ($)">
            <input type="number" name="criteria_minSpendPerTransaction" value={formState.criteria_minSpendPerTransaction} onChange={handleInputChange} className={`form-input ${formErrors.criteria_minSpendPerTransaction ? 'border-red-500' : ''}`} min="0" step="0.01" />
          </FormGroup>
          <FormGroup label="Min. Cumulative Spend ($)">
             <input type="number" name="criteria_cumulativeSpendTotal" value={formState.criteria_cumulativeSpendTotal} onChange={handleInputChange} className={`form-input ${formErrors.criteria_cumulativeSpendTotal ? 'border-red-500' : ''}`} min="0" step="0.01" />
          </FormGroup>
           <FormGroup label="Min. Purchases / Month">
            <input type="number" name="criteria_minPurchasesMonthly" value={formState.criteria_minPurchasesMonthly} onChange={handleInputChange} className={`form-input ${formErrors.criteria_minPurchasesMonthly ? 'border-red-500' : ''}`} min="1" />
          </FormGroup>
          <FormGroup label="Min. Referrals Made">
            <input type="number" name="criteria_minReferrals" value={formState.criteria_minReferrals} onChange={handleInputChange} className={`form-input ${formErrors.criteria_minReferrals ? 'border-red-500' : ''}`} min="1" />
          </FormGroup>
          <FormGroup label="Required Product IDs (comma-sep)" className="md:col-span-3">
             <input type="text" name="criteria_requiredProductIds" value={formState.criteria_requiredProductIds} onChange={handleInputChange} className={`form-input ${formErrors.criteria_requiredProductIds ? 'border-red-500' : ''}`} />
          </FormGroup>
           <FormGroup label="Excluded Product IDs (comma-sep)">
             <input type="text" name="criteria_excludedProductIds" value={formState.criteria_excludedProductIds} onChange={handleInputChange} className={`form-input ${formErrors.criteria_excludedProductIds ? 'border-red-500' : ''}`} />
          </FormGroup>
          <FormGroup label="Required Specific Product IDs (comma-sep)">
             <input type="text" name="criteria_requiresSpecificProductIds" value={formState.criteria_requiresSpecificProductIds} onChange={handleInputChange} className={`form-input ${formErrors.criteria_requiresSpecificProductIds ? 'border-red-500' : ''}`} />
          </FormGroup>
          <FormGroup label="Required Product Category">
             <input type="text" name="criteria_requiresProductCategory" value={formState.criteria_requiresProductCategory} onChange={handleInputChange} className={`form-input ${formErrors.criteria_requiresProductCategory ? 'border-red-500' : ''}`} />
          </FormGroup>
           <FormGroup label="Required Customer Tier (comma-sep)">
            <input type="text" name="criteria_requiredCustomerTier" placeholder="e.g., Gold, Silver" value={formState.criteria_requiredCustomerTier} onChange={handleInputChange} className={`form-input ${formErrors.criteria_requiredCustomerTier ? 'border-red-500' : ''}`} />
          </FormGroup>
          <FormGroup label="Allowed Days of Week (0-6, comma-sep)">
            <input type="text" name="criteria_allowedDaysOfWeek" placeholder="e.g., 1,2,3,4,5 for Mon-Fri" value={formState.criteria_allowedDaysOfWeek} onChange={handleInputChange} className={`form-input ${formErrors.criteria_allowedDaysOfWeek ? 'border-red-500' : ''}`} />
          </FormGroup>
          <FormGroup label="Valid Start Date (YYYY-MM-DD)">
            <input type="text" name="criteria_validStartDate" placeholder="Optional" value={formState.criteria_validStartDate} onChange={handleInputChange} className={`form-input ${formErrors.criteria_validStartDate ? 'border-red-500' : ''}`} />
          </FormGroup>
          <FormGroup label="Valid End Date (YYYY-MM-DD)">
            <input type="text" name="criteria_validEndDate" placeholder="Optional" value={formState.criteria_validEndDate} onChange={handleInputChange} className={`form-input ${formErrors.criteria_validEndDate ? 'border-red-500' : ''}`} />
          </FormGroup>
           <FormGroup label="Flags" className="md:col-span-3 pt-3 flex items-center space-x-6 flex-wrap">
              <label className="flex items-center space-x-1.5">
                <input type="checkbox" name="criteria_isBirthMonthOnly" checked={formState.criteria_isBirthMonthOnly} onChange={handleInputChange} className="form-checkbox"/> <span>Birth Month Only</span>
              </label>
              <label className="flex items-center space-x-1.5">
                <input type="checkbox" name="criteria_isBirthdayOnly" checked={formState.criteria_isBirthdayOnly} onChange={handleInputChange} className="form-checkbox"/> <span>Birthday Only</span>
              </label>
              <label className="flex items-center space-x-1.5">
                <input type="checkbox" name="criteria_isSignUpBonus" checked={formState.criteria_isSignUpBonus} onChange={handleInputChange} className="form-checkbox"/> <span>Is Sign-up Bonus</span>
              </label>
              <label className="flex items-center space-x-1.5">
                <input type="checkbox" name="criteria_isReferralBonusForNewUser" checked={formState.criteria_isReferralBonusForNewUser} onChange={handleInputChange} className="form-checkbox"/> <span>Referral Bonus (New User)</span>
              </label>
              <label className="flex items-center space-x-1.5">
                <input type="checkbox" name="criteria_isRewardForReferringUser" checked={formState.criteria_isRewardForReferringUser} onChange={handleInputChange} className="form-checkbox"/> <span>Referral Reward (Referrer)</span>
              </label>
            </FormGroup>
           <FormGroup label="Active Time Windows (JSON string)" className="md:col-span-3">
             <textarea 
                name="criteria_activeTimeWindows"
                placeholder='[{"startTime":"09:00", "endTime":"12:00"}, {"startTime":"14:00", "endTime":"17:00", "daysOfWeek":[1,2,3,4,5]}]' 
                value={formState.criteria_activeTimeWindows} 
                onChange={handleInputChange} 
                className={`form-input h-24 font-mono text-xs ${formErrors.activeTimeWindows ? 'border-red-500' : ''}`}
              />
             <p className="text-xs text-gray-500 mt-1">Enter a valid JSON array of TimeWindow objects (or leave empty). See types.ts for format.</p>
          </FormGroup>
        </div>

        {/* --- Earning Hint --- (Update value and onChange) */} 
        <h3 className="text-lg font-medium text-gray-700 mb-2">Other / Notes</h3>
        <div className="grid grid-cols-1 gap-4 mb-4">
            <FormGroup label="Earning Hint">
                <textarea name="earningHint" value={formState.earningHint} onChange={handleInputChange} className="form-input h-16"/>
            </FormGroup>
        </div>

        {/* --- Action Buttons --- (No change needed here) */} 
        <div className="flex items-center space-x-3 mt-6">
          <button 
            onClick={editingReward ? handleUpdateReward : handleAddNewReward} 
            className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg shadow-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors"
          >
            {editingReward ? 'Save Changes' : 'Add Reward'}
          </button>
          {editingReward && (
            <button 
              type="button" 
              onClick={handleCancelEdit} 
              className="px-4 py-2 bg-stone-200 text-stone-700 font-semibold rounded-lg hover:bg-stone-300 transition-colors"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      {/* Grant Voucher Section (No change needed here, uses separate state) */} 
      <div className="bg-white p-6 rounded-2xl shadow-lg mb-8">
        <h3 className="text-xl font-semibold text-stone-700 mb-4">Grant Voucher to Customer</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label htmlFor="grantCustomerId" className="block text-sm font-medium text-stone-600 mb-1">Customer ID (Email)</label>
            <input type="text" id="grantCustomerId" value={grantCustomerId} onChange={(e) => setGrantCustomerId(e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-lg" />
          </div>
          <div>
            <label htmlFor="grantRewardId" className="block text-sm font-medium text-stone-600 mb-1">Select Reward</label>
            <select id="grantRewardId" value={grantRewardId} onChange={(e) => setGrantRewardId(e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white">
              <option value="">-- Select Reward --</option>
              {grantableRewards.map(reward => (
                <option key={reward.id} value={reward.id}>{reward.name} ({reward.type})</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label htmlFor="grantNotes" className="block text-sm font-medium text-stone-600 mb-1">Notes (Optional)</label>
            <textarea id="grantNotes" value={grantNotes} onChange={(e) => setGrantNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-stone-300 rounded-lg"></textarea>
          </div>
        </div>
        {grantError && <p className="text-xs text-red-500 mt-2">{grantError}</p>}
        <button 
            onClick={handleGrantVoucher} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
            Grant Voucher
        </button>
      </div>

      {/* Existing Rewards List */}
      <div className="bg-white p-6 rounded-2xl shadow-lg">
        <h3 className="text-xl font-semibold text-stone-700 mb-4">Current Reward Definitions</h3>
        {rewardsData.length > 0 ? (
          <ul className="space-y-3">
            {rewardsData.map(reward => (
              <li key={reward.id} className="p-4 border border-stone-200 rounded-lg shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-stone-800">{reward.name} <span className="text-xs bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-full">({reward.type})</span></h4>
                    <p className="text-sm text-stone-600 mt-1">{reward.description || 'No description.'}</p>
                    {reward.earningHint && <p className="text-xs text-emerald-600 italic mt-1">Hint: {reward.earningHint}</p>}
                    {/* TODO: Display more criteria/effects details here */}
                  </div>
                  <div className="flex space-x-2 flex-shrink-0 ml-4">
                    <button onClick={() => handleStartEdit(reward)} className="text-xs px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 rounded-md font-medium">Edit</button>
                    <button onClick={() => onDeleteReward(reward.id)} className="text-xs px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md font-medium">Delete</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-stone-500">No rewards defined yet.</p>
        )}
      </div>
    </div>
  );
};

// Helper component for form styling (assuming form-input, form-select, form-checkbox exist in CSS or Tailwind config)
const FormGroup: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
    <div className={className}>
        <label className="block text-sm font-medium text-stone-600 mb-1">{label}</label>
        {children}
    </div>
);

export default EditRewards; 