import React, { useState, useEffect, useReducer, useRef, useMemo } from 'react';
import { RawRewardItem, User, RawRewardItemCriteria, TimeWindow, Product, ProcessedRewardItem } from '../types'; // Import the shared type from ../types.ts
import ImageUpload from '../components/ImageUpload';
import { uploadImage } from '../utils/imageUpload';

// User Select Modal Component for Grant Voucher
interface UserSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: User) => void;
}

const UserSelectModal: React.FC<UserSelectModalProps> = ({ isOpen, onClose, onSelectUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);

  // Fetch users based on search term
  useEffect(() => {
    if (!isOpen || !searchTerm.trim()) {
      setUsers([]);
      return;
    }

    const fetchUsers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('authToken');
        if (!token) throw new Error("Authentication required");

        const response = await fetch(`http://localhost:3001/api/users/search?q=${encodeURIComponent(searchTerm)}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to search users: ${response.status}`);
        }

        const data = await response.json();
        // Filter to only show customers
        const customerUsers = data.filter((user: User) => user.role === 'customer');
        setUsers(customerUsers);
      } catch (err: any) {
        console.error("Error searching users:", err);
        setError(err.message || "Failed to search users");
      } finally {
        setIsLoading(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        fetchUsers();
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, isOpen]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div ref={modalRef} className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800">Select Customer</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search customers by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}
        
        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="py-4 text-center text-gray-500">Searching...</div>
          ) : users.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {users.map((user) => (
                <li 
                  key={user.internalId} 
                  className="py-3 px-2 hover:bg-gray-50 cursor-pointer flex items-center"
                  onClick={() => onSelectUser(user)}
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full mr-3 object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full mr-3 bg-blue-100 text-blue-600 flex items-center justify-center font-medium">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-800">{user.name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : searchTerm.length >= 2 ? (
            <div className="py-4 text-center text-gray-500">No customers found</div>
          ) : (
            <div className="py-4 text-center text-gray-500">Type at least 2 characters to search</div>
          )}
        </div>
      </div>
    </div>
  );
};

// New Reward Select Modal Component for Grant Voucher
interface RewardSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectReward: (rewardId: string, rewardName: string) => void;
  rewards: ProcessedRewardItem[];
  selectedCustomer: User | null;
}

const RewardSelectModal: React.FC<RewardSelectModalProps> = ({ 
  isOpen, 
  onClose, 
  onSelectReward, 
  rewards,
  selectedCustomer
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  // Filter rewards based on search term
  const filteredRewards = useMemo(() => {
    if (!searchTerm.trim()) return rewards;
    
    return rewards.filter(reward => 
      reward.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (reward.description && reward.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [rewards, searchTerm]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !selectedCustomer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div ref={modalRef} className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800">
            Select Reward for {selectedCustomer.name}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search rewards..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="overflow-y-auto flex-1">
          {filteredRewards.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {filteredRewards.map((reward) => (
                <li 
                  key={reward.id || reward.reward_id} 
                  className="py-3 px-2 hover:bg-amber-50 cursor-pointer"
                  onClick={() => onSelectReward(reward.id || reward.reward_id || '', reward.name)}
                >
                  <div className="flex items-center">
                    {reward.image && (
                      <img 
                        src={reward.image} 
                        alt={reward.name} 
                        className="w-10 h-10 rounded-md mr-3 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/src/assets/rewards.png';
                        }}
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{reward.name}</p>
                      <p className="text-sm text-gray-500 line-clamp-1">{reward.description}</p>
                      <div className="flex gap-2 mt-1">
                        {reward.type && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
                            {reward.type.replace('_', ' ')}
                          </span>
                        )}
                        {reward.pointsCost !== undefined && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs">
                            {reward.pointsCost} points
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-4 text-center text-gray-500">
              {searchTerm ? `No rewards matching "${searchTerm}"` : "No rewards available"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// New Notes Modal Component for Grant Voucher
interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (notes: string) => void;
  selectedCustomer: User | null;
  selectedReward: { id: string; name: string } | null;
}

const NotesModal: React.FC<NotesModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  selectedCustomer,
  selectedReward
}) => {
  const [notes, setNotes] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(notes);
  };

  if (!isOpen || !selectedCustomer || !selectedReward) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div ref={modalRef} className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800">
            Add Notes (Optional)
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            You're granting <span className="font-medium text-amber-700">{selectedReward.name}</span> to <span className="font-medium">{selectedCustomer.name}</span>.
          </p>
          <form onSubmit={handleSubmit}>
            <textarea
              placeholder="Enter any notes about this reward grant (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Grant Reward
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

interface EditRewardsProps {
  grantVoucherFunction: (customerId: string, rewardId: string, grantedByEmployeeId: string, notes?: string) => Promise<any>;
  loggedInUser: User | null;
}

// --- Step 2: Define State Shape for Reducer ---
interface RewardFormState {
  name: string;
  image: string;
  type: RawRewardItem['type'];
  description: string;
  pointsCost: string;
  freeMenuItemIds: string[]; // Array of strings
  discountPercentage: string;
  discountFixedAmount: string;
  earningHint: string;
  // Criteria fields
  criteria_minSpend: string;
  criteria_minPoints: string;
  criteria_requiredProductIds: string[]; // Array of strings
  criteria_excludedProductIds: string[]; // Array of strings
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
  criteria_requiresSpecificProductIds: string[]; // Array of strings
  criteria_requiresProductCategory: string; 
}

// --- Step 3: Define Action Types ---
type FormAction = 
  | { type: 'SET_FIELD'; field: keyof RewardFormState; value: any }
  | { type: 'LOAD_REWARD'; payload: ProcessedRewardItem }
  | { type: 'RESET_FORM' };

// --- Helper Function to Map RawRewardItem to Form State ---
const mapRewardToFormState = (reward: ProcessedRewardItem): RewardFormState => {
  return {
    name: reward.name,
    image: reward.image || '/src/assets/rewards.png',
    type: reward.type,
    description: reward.description || '',
    pointsCost: reward.pointsCost?.toString() || '',
    freeMenuItemIds: reward.freeMenuItemIds?.filter(Boolean) || [],
    discountPercentage: reward.discountPercentage?.toString() || '',
    discountFixedAmount: reward.discountFixedAmount?.toString() || '',
    earningHint: reward.earningHint || '',
    // Map criteria fields
    criteria_minSpend: reward.criteria?.minSpend?.toString() || '',
    criteria_minPoints: reward.criteria?.minPoints?.toString() || '',
    criteria_requiredProductIds: reward.criteria?.requiredProductIds?.filter(Boolean) || [],
    criteria_excludedProductIds: reward.criteria?.excludedProductIds?.filter(Boolean) || [],
    criteria_isBirthMonthOnly: reward.criteria?.isBirthMonthOnly || false,
    criteria_isBirthdayOnly: reward.criteria?.isBirthdayOnly || false,
    criteria_minPurchasesMonthly: reward.criteria?.minPurchasesMonthly?.toString() || '',
    criteria_allowedDaysOfWeek: reward.criteria?.allowedDaysOfWeek?.join(',') || '',
    criteria_activeTimeWindows: reward.criteria?.activeTimeWindows ? JSON.stringify(reward.criteria.activeTimeWindows) : '',
    criteria_requiredCustomerTier: reward.criteria?.requiredCustomerTier?.join(',') || '',
    criteria_isSignUpBonus: reward.criteria?.isSignUpBonus || false,
    criteria_isReferralBonusForNewUser: reward.criteria?.isReferralBonusForNewUser || false,
    criteria_isRewardForReferringUser: reward.criteria?.isRewardForReferringUser || false,
    criteria_minReferrals: reward.criteria?.minReferrals?.toString() || '',
    criteria_validStartDate: reward.criteria?.validDateRange?.startDate || '',
    criteria_validEndDate: reward.criteria?.validDateRange?.endDate || '',
    criteria_cumulativeSpendTotal: reward.criteria?.cumulativeSpendTotal?.toString() || '',
    criteria_minSpendPerTransaction: reward.criteria?.minSpendPerTransaction?.toString() || '',
    criteria_requiresSpecificProductIds: reward.criteria?.requiresSpecificProductIds?.filter(Boolean) || [],
    criteria_requiresProductCategory: reward.criteria?.requiresProductCategory || ''
  };
};

// --- Initial State for Reducer ---
const initialFormState: RewardFormState = {
    name: '',
    image: '/src/assets/rewards.png', // Default image
    type: 'standard',
    description: '',
    pointsCost: '',
    freeMenuItemIds: [],
    discountPercentage: '',
    discountFixedAmount: '',
    earningHint: '',
    // Initialize all criteria fields
    criteria_minSpend: '',
    criteria_minPoints: '',
    criteria_requiredProductIds: [],
    criteria_excludedProductIds: [],
    criteria_isBirthMonthOnly: false,
    criteria_isBirthdayOnly: false,
    criteria_minPurchasesMonthly: '',
    criteria_allowedDaysOfWeek: '',
    criteria_activeTimeWindows: '',
    criteria_requiredCustomerTier: '',
    criteria_isSignUpBonus: false,
    criteria_isReferralBonusForNewUser: false,
    criteria_isRewardForReferringUser: false,
    criteria_minReferrals: '',
    criteria_validStartDate: '',
    criteria_validEndDate: '',
    criteria_cumulativeSpendTotal: '',
    criteria_minSpendPerTransaction: '',
    criteria_requiresSpecificProductIds: [],
    criteria_requiresProductCategory: '',
};

// --- Step 4: Implement the Reducer Function ---
function formReducer(state: RewardFormState, action: FormAction): RewardFormState {
  try {
    switch (action.type) {
      case 'SET_FIELD':
        // Handle arrays safely
        if (
          action.field === 'freeMenuItemIds' || 
          action.field === 'criteria_requiredProductIds' || 
          action.field === 'criteria_excludedProductIds' || 
          action.field === 'criteria_requiresSpecificProductIds'
        ) {
          // Ensure the value is always a valid array
          const arrayValue = Array.isArray(action.value) 
            ? action.value.filter(Boolean) 
            : [];
          
          return { ...state, [action.field]: arrayValue };
        }
        
        // Handle general case
        return { ...state, [action.field]: action.value };
      
      case 'LOAD_REWARD':
        console.log('[formReducer] Loading reward:', action.payload);
        try {
          const criteria = action.payload.criteria || {};
          
          // Create a safe processed version of the reward
          return {
            name: action.payload.name || '',
            image: action.payload.image || '/src/assets/rewards.png',
            type: action.payload.type || 'standard',
            description: action.payload.description || '',
            pointsCost: action.payload.pointsCost?.toString() || '',
            freeMenuItemIds: Array.isArray(action.payload.freeMenuItemIds) 
              ? action.payload.freeMenuItemIds.filter(Boolean) 
              : [],
            discountPercentage: action.payload.discountPercentage?.toString() || '',
            discountFixedAmount: action.payload.discountFixedAmount?.toString() || '',
            earningHint: action.payload.earningHint || '',
            // Criteria fields with safe defaults
            criteria_minSpend: criteria.minSpend?.toString() || '',
            criteria_minPoints: criteria.minPoints?.toString() || '',
            criteria_requiredProductIds: Array.isArray(criteria.requiredProductIds) 
              ? criteria.requiredProductIds.filter(Boolean) 
              : [],
            criteria_excludedProductIds: Array.isArray(criteria.excludedProductIds) 
              ? criteria.excludedProductIds.filter(Boolean) 
              : [],
            criteria_isBirthMonthOnly: !!criteria.isBirthMonthOnly,
            criteria_isBirthdayOnly: !!criteria.isBirthdayOnly,
            criteria_minPurchasesMonthly: criteria.minPurchasesMonthly?.toString() || '',
            criteria_allowedDaysOfWeek: Array.isArray(criteria.allowedDaysOfWeek) 
              ? criteria.allowedDaysOfWeek.join(',') 
              : '',
            criteria_activeTimeWindows: criteria.activeTimeWindows 
              ? JSON.stringify(criteria.activeTimeWindows) 
              : '',
            criteria_requiredCustomerTier: Array.isArray(criteria.requiredCustomerTier) 
              ? criteria.requiredCustomerTier.join(',') 
              : '',
            criteria_isSignUpBonus: !!criteria.isSignUpBonus,
            criteria_isReferralBonusForNewUser: !!criteria.isReferralBonusForNewUser,
            criteria_isRewardForReferringUser: !!criteria.isRewardForReferringUser,
            criteria_minReferrals: criteria.minReferrals?.toString() || '',
            criteria_validStartDate: criteria.validDateRange?.startDate || '',
            criteria_validEndDate: criteria.validDateRange?.endDate || '',
            criteria_cumulativeSpendTotal: criteria.cumulativeSpendTotal?.toString() || '',
            criteria_minSpendPerTransaction: criteria.minSpendPerTransaction?.toString() || '',
            criteria_requiresSpecificProductIds: Array.isArray(criteria.requiresSpecificProductIds) 
              ? criteria.requiresSpecificProductIds.filter(Boolean) 
              : [],
            criteria_requiresProductCategory: criteria.requiresProductCategory || '',
          };
        } catch (error) {
          console.error("[formReducer] Error loading reward:", error);
          // Return current state on error to prevent crashes
          return state;
        }
        
      case 'RESET_FORM':
        return initialFormState;
        
      default:
        return state;
    }
  } catch (error) {
    console.error("[formReducer] Unhandled error in reducer:", error);
    // Return current state to prevent crashes
    return state;
  }
}

const EditRewards: React.FC<EditRewardsProps> = ({ 
  grantVoucherFunction,
  loggedInUser
}) => {

  // --- State for API calls ---
  const [isLoading, setIsLoading] = useState<boolean>(false); // General loading for form actions
  const [error, setError] = useState<string | null>(null); // General error for form actions
  const [rewardDefinitionsLoading, setRewardDefinitionsLoading] = useState<boolean>(true); // Specific loading for list fetch
  const [rewardDefinitionsError, setRewardDefinitionsError] = useState<string | null>(null); // Specific error for list fetch
  const [rewardDefinitions, setRewardDefinitions] = useState<ProcessedRewardItem[]>([]); // State to hold fetched definitions
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null); // ID of the reward being edited
  const [isAddingNewReward, setIsAddingNewReward] = useState<boolean>(false); // State to indicate if a new reward is being added

  // --- Form state using reducer ---
  const [formState, dispatch] = useReducer(formReducer, initialFormState);
  const [editingReward, setEditingReward] = useState<ProcessedRewardItem | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // --- Grant Voucher State ---
  const [showUserSelectModal, setShowUserSelectModal] = useState<boolean>(false);
  const [showRewardSelectModal, setShowRewardSelectModal] = useState<boolean>(false);
  const [showNotesModal, setShowNotesModal] = useState<boolean>(false);
  const [selectedCustomer, setSelectedCustomer] = useState<User | null>(null);
  const [selectedReward, setSelectedReward] = useState<{ id: string; name: string } | null>(null);
  const [grantSuccessMessage, setGrantSuccessMessage] = useState<string | null>(null);

  // --- Product List State ---
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  // --- Fetch Reward Definitions ---
  const fetchRewardDefinitions = async () => {
    setRewardDefinitionsLoading(true);
    setRewardDefinitionsError(null);

    try {
      const token = localStorage.getItem('authToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };

      const response = await fetch('http://localhost:3001/api/rewards/definitions', {
        headers: headers,
      });

      if (!response.ok) {
        let errorDetail = `HTTP error ${response.status}`;
        try {
          const errorData = await response.json();
          errorDetail = errorData.message || errorDetail;
        } catch (e) {
          // Ignore parsing error if response is not JSON
        }
        throw new Error(errorDetail);
      }
      
      let data;
      try {
        data = await response.json();
        console.log("Raw data from backend:", data);
      } catch (jsonError) {
        console.error("Error parsing response JSON:", jsonError);
        throw new Error("Invalid response format from server");
      }

      // Ensure we have an array of rewards
      let rewardsArray: any[] = [];
      try {
        if (Array.isArray(data)) {
          rewardsArray = data;
        } else if (data && typeof data === 'object') {
          rewardsArray = data.rewards || [data];
        } else {
          console.error("Unexpected data format:", data);
          rewardsArray = [];
        }
      } catch (e) {
        console.error("Error processing rewards array:", e);
        rewardsArray = [];
      }
      
      const processedData = rewardsArray.map((reward: any) => {
        try {
          // Create a standardized RawRewardItem from the received data
          const rawReward: RawRewardItem = {
            reward_id: reward?.reward_id || '',
            name: reward?.name || '',
            description: reward?.description || '',
            image_url: reward?.image_url || '',
            type: reward?.type || 'standard',
            criteria_json: reward?.criteria_json || '',
            points_cost: reward?.points_cost !== undefined ? Number(reward.points_cost) : undefined,
            free_menu_item_ids: Array.isArray(reward?.free_menu_item_ids) 
              ? reward.free_menu_item_ids 
              : typeof reward?.free_menu_item_ids === 'string'
                ? reward.free_menu_item_ids.split(',')
                : [],
            discount_percentage: reward?.discount_percentage !== undefined ? Number(reward.discount_percentage) : undefined,
            discount_fixed_amount: reward?.discount_fixed_amount !== undefined ? Number(reward.discount_fixed_amount) : undefined,
            earning_hint: reward?.earning_hint || '',
            created_at: reward?.created_at,
            updated_at: reward?.updated_at
          };
          
          return convertRawToProcessed(rawReward);
        } catch (error) {
          console.error("Error processing reward:", error, reward);
          // Return a minimal valid reward to prevent crashes
          return {
            id: reward?.reward_id || `error-${Date.now()}`,
            reward_id: reward?.reward_id || `error-${Date.now()}`,
            name: reward?.name || 'Error: Invalid Reward',
            description: 'There was an error processing this reward',
            image: '/src/assets/rewards.png',
            type: 'standard' as const,
            freeMenuItemIds: []
          } as ProcessedRewardItem;
        }
      });

      setRewardDefinitions(processedData);
      console.log("[fetchRewardDefinitions] State after setting:", processedData);

    } catch (err: any) {
      console.error("Failed to fetch reward definitions:", err);
      setRewardDefinitionsError(err.message || 'An unknown error occurred while fetching reward definitions.');
    } finally {
      setRewardDefinitionsLoading(false);
    }
  };

  // Fetch rewards on component mount
  useEffect(() => {
    fetchRewardDefinitions();
  }, []); // Empty dependency array means this runs once on mount

  // Handle the backend URL prefix for uploaded images
  const ensureFullImageUrl = (imageUrl: string): string => {
    if (!imageUrl || imageUrl === '/src/assets/rewards.png') {
      return imageUrl;
    }
    
    // If it's already a full URL (including our localhost URL) or data URL, return as is
    if (imageUrl.startsWith('http') || imageUrl.startsWith('data:')) {
      return imageUrl;
    }
    
    // Add leading slash if missing
    if (!imageUrl.startsWith('/')) {
      imageUrl = '/' + imageUrl;
    }
    
    // If it's an uploads path, ensure the backend server URL is included
    if (imageUrl.includes('/uploads/')) {
      return `http://localhost:3001${imageUrl}`;
    }
    
    // Default backend path
    return `http://localhost:3001${imageUrl}`;
  };

  // Handle data URL to file conversion for image uploads
  const dataURLToFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const handleImageChange = async (file: File | null, previewUrl: string) => {
    try {
      // Just update the state with the preview URL for now
      // The actual upload happens during save/update
      dispatch({ 
        type: 'SET_FIELD', 
        field: 'image', 
        value: previewUrl 
      });
      console.log("[handleImageChange] Updated image in form state:", previewUrl);
    } catch (err: any) {
      console.error('Error updating reward image:', err);
      setError(err.message || 'Failed to update reward image');
    }
  };

  // Map form state back to backend RawRewardItem format
  const mapFormStateToBackendPayload = (formState: RewardFormState): Partial<RawRewardItem> => {
    console.log("[mapFormStateToBackendPayload] Form state:", formState);
    
    // Create criteria object, only including fields that have values
    const criteria: RawRewardItemCriteria = {};

    // Number fields
    if (formState.criteria_minSpend) {
      criteria.minSpend = parseFloat(formState.criteria_minSpend);
    }
    if (formState.criteria_minPoints) {
      criteria.minPoints = parseInt(formState.criteria_minPoints);
    }
    if (formState.criteria_minPurchasesMonthly) {
      criteria.minPurchasesMonthly = parseInt(formState.criteria_minPurchasesMonthly);
    }
    if (formState.criteria_minReferrals) {
      criteria.minReferrals = parseInt(formState.criteria_minReferrals);
    }
    if (formState.criteria_cumulativeSpendTotal) {
      criteria.cumulativeSpendTotal = parseFloat(formState.criteria_cumulativeSpendTotal);
    }
    if (formState.criteria_minSpendPerTransaction) {
      criteria.minSpendPerTransaction = parseFloat(formState.criteria_minSpendPerTransaction);
    }
    
    // Array fields
    if (formState.criteria_requiredProductIds?.length > 0) {
      criteria.requiredProductIds = formState.criteria_requiredProductIds.filter(Boolean);
    }
    if (formState.criteria_excludedProductIds?.length > 0) {
      criteria.excludedProductIds = formState.criteria_excludedProductIds.filter(Boolean);
    }
    if (formState.criteria_requiresSpecificProductIds?.length > 0) {
      criteria.requiresSpecificProductIds = formState.criteria_requiresSpecificProductIds.filter(Boolean);
    }
    
    // Boolean fields
    if (formState.criteria_isBirthMonthOnly) {
      criteria.isBirthMonthOnly = true;
    }
    if (formState.criteria_isBirthdayOnly) {
      criteria.isBirthdayOnly = true;
    }
    if (formState.criteria_isSignUpBonus) {
      criteria.isSignUpBonus = true;
    }
    if (formState.criteria_isReferralBonusForNewUser) {
      criteria.isReferralBonusForNewUser = true;
    }
    if (formState.criteria_isRewardForReferringUser) {
      criteria.isRewardForReferringUser = true;
    }
    
    // String and special fields
    if (formState.criteria_allowedDaysOfWeek) {
      criteria.allowedDaysOfWeek = formState.criteria_allowedDaysOfWeek
        .split(',')
        .map(n => parseInt(n.trim()))
        .filter(n => !isNaN(n) && n >= 0 && n <= 6); // Make sure we only have valid days 0-6
    }
    
    if (formState.criteria_activeTimeWindows) {
      try {
        criteria.activeTimeWindows = JSON.parse(formState.criteria_activeTimeWindows);
      } catch (e) {
        console.error("Failed to parse activeTimeWindows:", e);
      }
    }
    
    if (formState.criteria_requiredCustomerTier) {
      criteria.requiredCustomerTier = formState.criteria_requiredCustomerTier
        .split(',')
        .map(tier => tier.trim())
        .filter(Boolean);
    }
    
    if (formState.criteria_validStartDate || formState.criteria_validEndDate) {
      criteria.validDateRange = {
        startDate: formState.criteria_validStartDate || undefined,
        endDate: formState.criteria_validEndDate || undefined
      };
    }
    
    if (formState.criteria_requiresProductCategory) {
      criteria.requiresProductCategory = formState.criteria_requiresProductCategory;
    }

    // Build the main payload, carefully mapping from form state to backend format
    const payload: Partial<RawRewardItem> = {
      name: formState.name.trim(),
      type: formState.type,
      description: formState.description.trim() || undefined,
    };
    
    // Handle image URL - strip the server base URL if present to send relative path to backend
    if (formState.image && formState.image !== '/src/assets/rewards.png') {
      // Remove the http://localhost:3001 prefix if present
      let imageUrl = formState.image;
      if (imageUrl.startsWith('http://localhost:3001')) {
        imageUrl = imageUrl.replace('http://localhost:3001', '');
      }
      payload.image_url = imageUrl;
    }
    
    // Add criteria JSON if we have criteria
    if (Object.keys(criteria).length > 0) {
      payload.criteria_json = JSON.stringify(criteria);
    }

    // Numeric fields (only include if they have valid values)
    if (formState.pointsCost && !isNaN(parseFloat(formState.pointsCost))) {
      payload.points_cost = parseInt(formState.pointsCost);
    }
    if (formState.discountPercentage && !isNaN(parseFloat(formState.discountPercentage))) {
      payload.discount_percentage = parseFloat(formState.discountPercentage);
    }
    if (formState.discountFixedAmount && !isNaN(parseFloat(formState.discountFixedAmount))) {
      payload.discount_fixed_amount = parseFloat(formState.discountFixedAmount);
    }
    
    // String fields only if they have content
    if (formState.earningHint?.trim()) {
      payload.earning_hint = formState.earningHint.trim();
    }
    
    // Array fields only if they have content
    if (formState.freeMenuItemIds?.length > 0) {
      payload.free_menu_item_ids = formState.freeMenuItemIds.filter(Boolean);
    }

    console.log("[mapFormStateToBackendPayload] Final payload:", payload);
    return payload;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let finalValue: string | boolean = value;

    // Handle checkbox boolean values
    if (type === 'checkbox') {
        finalValue = (e.target as HTMLInputElement).checked;
    }

    dispatch({ type: 'SET_FIELD', field: name as keyof RewardFormState, value: finalValue });
    setError(null); // Clear general error on input change
    // Potentially clear field-specific errors here too if implemented
  };

  const handleStartEdit = (reward: ProcessedRewardItem) => {
    console.log('[handleStartEdit] Starting edit for reward:', reward);
    
    // Check for either reward_id or id
    const rewardId = reward.reward_id || reward.id;
    if (!rewardId) {
        console.error("Cannot edit reward without ID:", reward);
        setError("Cannot edit reward: Missing ID");
        return;
    }
    
    setEditingRewardId(rewardId);
    setEditingReward(reward);
    setIsAddingNewReward(false);
    
    // Create a clean form state from the reward data
    const formState = mapRewardToFormState(reward);

    // Make sure the image URL is properly formatted for display
    if (formState.image && formState.image !== '/src/assets/rewards.png') {
        formState.image = ensureFullImageUrl(formState.image);
    }

    // Set all fields in the form state
    Object.entries(formState).forEach(([key, value]) => {
        dispatch({ type: 'SET_FIELD', field: key as keyof RewardFormState, value });
    });

    console.log('[handleStartEdit] Form state loaded:', formState);
    setError(null);
    setIsLoading(false);
  };

  const handleCancelEdit = () => {
      setEditingRewardId(null);
      setIsAddingNewReward(false); // Ensure not in adding mode when canceling
    dispatch({ type: 'RESET_FORM' });
      setError(null); // Clear errors
      setIsLoading(false); // Ensure loading is off
  };
  
  const resetFormAndEditingState = (isAdding: boolean = false) => {
      setEditingRewardId(null);
      setIsAddingNewReward(isAdding); // Set to true when adding new reward
    dispatch({ type: 'RESET_FORM' });
      setError(null);
      setIsLoading(false);
  };

  const validateForm = (): boolean => {
      // Basic validation
      if (!formState.name.trim()) {
          setError("Reward name is required.");
          return false;
      }
      if (!formState.type) {
          setError("Reward type is required.");
          return false;
      }

      // Type-specific validation
      switch (formState.type) {
          case 'standard':
              if (!formState.pointsCost && (!formState.freeMenuItemIds || formState.freeMenuItemIds.length === 0)) {
                  setError("Standard rewards must specify either points cost or free menu items.");
                  return false;
              }
              break;
          case 'discount_coupon':
              if (!formState.discountPercentage && !formState.discountFixedAmount) {
                  setError("Discount coupons must specify either a percentage or fixed amount discount.");
                  return false;
              }
              if (formState.discountPercentage && (isNaN(parseFloat(formState.discountPercentage)) || parseFloat(formState.discountPercentage) > 100)) {
                  setError("Discount percentage must be a valid number between 0 and 100.");
                  return false;
              }
              if (formState.discountFixedAmount && isNaN(parseFloat(formState.discountFixedAmount))) {
                  setError("Fixed discount amount must be a valid number.");
                  return false;
              }
              break;
          case 'voucher':
              if ((!formState.freeMenuItemIds || formState.freeMenuItemIds.length === 0) && !formState.discountPercentage && !formState.discountFixedAmount) {
                  setError("Vouchers must specify either free menu items or a discount.");
                  return false;
              }
              break;
      }

      // Validate numeric fields if they're provided
      if (formState.pointsCost && (isNaN(parseFloat(formState.pointsCost)) || parseFloat(formState.pointsCost) < 0)) {
          setError("Points cost must be a valid positive number.");
          return false;
      }

      // Validate criteria fields if they're provided
      if (formState.criteria_minSpend && (isNaN(parseFloat(formState.criteria_minSpend)) || parseFloat(formState.criteria_minSpend) < 0)) {
          setError("Minimum spend criteria must be a valid positive number.");
          return false;
      }
      if (formState.criteria_minPoints && (isNaN(parseFloat(formState.criteria_minPoints)) || parseFloat(formState.criteria_minPoints) < 0)) {
          setError("Minimum points criteria must be a valid positive number.");
          return false;
      }
      if (formState.criteria_minPurchasesMonthly && (isNaN(parseFloat(formState.criteria_minPurchasesMonthly)) || parseFloat(formState.criteria_minPurchasesMonthly) < 0)) {
          setError("Minimum monthly purchases criteria must be a valid positive number.");
          return false;
      }
      if (formState.criteria_minReferrals && (isNaN(parseFloat(formState.criteria_minReferrals)) || parseFloat(formState.criteria_minReferrals) < 0)) {
          setError("Minimum referrals criteria must be a valid positive number.");
          return false;
      }
      if (formState.criteria_cumulativeSpendTotal && (isNaN(parseFloat(formState.criteria_cumulativeSpendTotal)) || parseFloat(formState.criteria_cumulativeSpendTotal) < 0)) {
          setError("Cumulative spend total criteria must be a valid positive number.");
          return false;
      }
      if (formState.criteria_minSpendPerTransaction && (isNaN(parseFloat(formState.criteria_minSpendPerTransaction)) || parseFloat(formState.criteria_minSpendPerTransaction) < 0)) {
          setError("Minimum spend per transaction criteria must be a valid positive number.");
          return false;
      }

      // Validate date fields if provided
      if (formState.criteria_validStartDate && formState.criteria_validEndDate) {
          const startDate = new Date(formState.criteria_validStartDate);
          const endDate = new Date(formState.criteria_validEndDate);
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
              setError("Invalid date format in validity range.");
              return false;
          }
          if (endDate < startDate) {
              setError("End date cannot be before start date.");
              return false;
          }
      }

      // Make sure activeTimeWindows is valid JSON if provided
      if (formState.criteria_activeTimeWindows) {
          try {
              const timeWindows = JSON.parse(formState.criteria_activeTimeWindows);
              // Basic validation that it's an array
              if (!Array.isArray(timeWindows)) {
                  setError("Active time windows must be an array.");
                  return false;
              }
              // Validate each time window
              for (const window of timeWindows) {
                  if (!window.startTime || !window.endTime) {
                      setError("Each time window must have startTime and endTime.");
                      return false;
                  }
                  if (window.daysOfWeek && !Array.isArray(window.daysOfWeek)) {
                      setError("daysOfWeek must be an array of numbers (0-6).");
                      return false;
                  }
              }
          } catch (e) {
              setError("Active time windows must be valid JSON.");
              return false;
          }
      }

      setError(null); // Clear previous errors if validation passes
      return true;
  };

  // Helper function to convert RawRewardItem from backend to ProcessedRewardItem
  const convertRawToProcessed = (reward: RawRewardItem | any): ProcessedRewardItem => {
    if (!reward) {
      console.error("[convertRawToProcessed] Received null or undefined reward");
      // Return a default ProcessedRewardItem to avoid crashes
      return {
        id: '',
        reward_id: '',
        name: 'Invalid Reward',
        description: 'This reward has missing or invalid data',
        image: '/src/assets/rewards.png',
        type: 'standard' as const,
        freeMenuItemIds: []
      } as ProcessedRewardItem;
    }
    
    console.log("[convertRawToProcessed] Processing reward:", reward);
    
    // Parse criteria if it exists
    let parsedCriteria: RawRewardItemCriteria | undefined;
    if (reward.criteria_json) {
      try {
        parsedCriteria = typeof reward.criteria_json === 'string' 
          ? JSON.parse(reward.criteria_json) 
          : reward.criteria_json;
      } catch (e) {
        console.error("Failed to parse criteria_json:", e);
        // If parsing fails, try to use the criteria field directly
        if (reward.criteria && typeof reward.criteria === 'object') {
          parsedCriteria = reward.criteria;
        } else {
          // If both fail, set to empty object to avoid null reference errors
          parsedCriteria = {};
        }
      }
    } else if (reward.criteria && typeof reward.criteria === 'object') {
      parsedCriteria = reward.criteria;
    }

    // Ensure we have a consistent reward_id
    const rewardId = reward.reward_id || reward.id || '';
    if (!rewardId) {
      console.warn("Warning: Reward has no ID:", reward);
    }

    // Ensure image URL is properly formatted
    let imageUrl = reward.image_url || reward.image || '/src/assets/rewards.png';
    imageUrl = ensureFullImageUrl(imageUrl);

    // Handle free menu items - ensure it's always an array
    let freeMenuItems: string[] = [];
    if (Array.isArray(reward.free_menu_item_ids)) {
      freeMenuItems = reward.free_menu_item_ids.filter(Boolean);
    } else if (Array.isArray(reward.freeMenuItemIds)) {
      freeMenuItems = reward.freeMenuItemIds.filter(Boolean);
    } else if (typeof reward.free_menu_item_ids === 'string') {
      // Handle comma-separated string from GROUP_CONCAT
      freeMenuItems = reward.free_menu_item_ids.split(',').filter(Boolean);
    } else if (typeof reward.freeMenuItemIds === 'string') {
      freeMenuItems = reward.freeMenuItemIds.split(',').filter(Boolean);
    }

    // Convert to ProcessedRewardItem format with safe fallbacks for all fields
    const processed: ProcessedRewardItem = {
      id: rewardId,
      reward_id: rewardId,
      name: reward.name || 'Unnamed Reward',
      description: reward.description || '',
      image: imageUrl,
      type: reward.type || 'standard',
      pointsCost: typeof reward.points_cost === 'number' ? reward.points_cost : 
                 typeof reward.pointsCost === 'number' ? reward.pointsCost : undefined,
      discountPercentage: typeof reward.discount_percentage === 'number' ? reward.discount_percentage :
                        typeof reward.discountPercentage === 'number' ? reward.discountPercentage : undefined,
      discountFixedAmount: typeof reward.discount_fixed_amount === 'number' ? reward.discount_fixed_amount :
                         typeof reward.discountFixedAmount === 'number' ? reward.discountFixedAmount : undefined,
      earningHint: reward.earning_hint || reward.earningHint || '',
      criteria: parsedCriteria,
      freeMenuItemIds: freeMenuItems
    };

    console.log("[convertRawToProcessed] Processed reward:", processed);
    return processed;
  };

  const handleAddReward = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');
      const headers: HeadersInit = { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };

      // First handle the image if it's not the default one
      let imageUrl = formState.image;
      if (imageUrl && imageUrl !== '/src/assets/rewards.png' && imageUrl.startsWith('data:')) {
        // Upload the image and get the URL from server
        try {
          const file = dataURLToFile(imageUrl, `reward-image-${Date.now()}.jpg`);
          imageUrl = await uploadImage(file);
          console.log("[handleAddReward] Image uploaded successfully:", imageUrl);
        } catch (imgError: any) {
          console.error("Failed to process reward image:", imgError);
          setError(`Image upload failed: ${imgError.message || 'Unknown error'}`);
          setIsLoading(false);
          return;
        }
      }

      // Map form state to backend payload with updated image URL
      const payload = mapFormStateToBackendPayload({ 
        ...formState, 
        image: imageUrl 
      });
      console.log('[handleAddReward] Sending payload:', payload);

      const response = await fetch('http://localhost:3001/api/rewards/definitions', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMessage = `Failed to add reward. Status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // If not JSON, use the default error message
        }
        throw new Error(errorMessage);
      }

      const newReward = await response.json();
      console.log('New reward added:', newReward);

      // Refresh the rewards list after adding
      await fetchRewardDefinitions();
      
      // Reset form and editing state
      resetFormAndEditingState();
      alert('Reward added successfully!');

    } catch (err: any) {
      console.error("Error adding reward:", err);
      setError(err.message || 'An unexpected error occurred while adding the reward.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateReward = async () => {
    console.log("[handleUpdateReward] Starting update...");
    
    // Check if we have a reward ID to update
    if (!editingRewardId) {
      console.error("[handleUpdateReward] No editing reward ID found");
      setError("Cannot update reward: Missing ID");
      return;
    }

    // Validate form before proceeding
    if (!validateForm()) {
      console.error("[handleUpdateReward] Form validation failed");
      return; // validateForm will set the appropriate error message
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication token missing. Please log in again.');
      }

      // Log the current image URL for debugging
      console.log("[handleUpdateReward] Current image URL:", formState.image);

      // Handle the image upload if needed
      let imageUrl = formState.image;
      if (imageUrl && imageUrl !== '/src/assets/rewards.png' && imageUrl.startsWith('data:')) {
        try {
          const file = dataURLToFile(imageUrl, `reward-image-update-${Date.now()}.jpg`);
          imageUrl = await uploadImage(file);
          console.log("[handleUpdateReward] Image uploaded successfully:", imageUrl);
        } catch (imgError: any) {
          console.error("Failed to process reward image:", imgError);
          setError(`Image upload failed: ${imgError.message || 'Unknown error'}`);
          setIsLoading(false);
          return;
        }
      }

      // Map form state to backend payload with updated image URL
      const payload = mapFormStateToBackendPayload({
        ...formState,
        image: imageUrl
      });
      
      // Log the final payload for debugging
      console.log("[handleUpdateReward] Mapped payload:", payload);
      console.log("[handleUpdateReward] Image URL being sent:", payload.image_url);

      const headers: HeadersInit = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const response = await fetch(`http://localhost:3001/api/rewards/definitions/${editingRewardId}`, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMessage = `Failed to update reward. Status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // If not JSON, use the default error message
        }
        throw new Error(errorMessage);
      }

      const updatedReward = await response.json();
      console.log("[handleUpdateReward] Update successful:", updatedReward);

      // Refresh the rewards list after updating to ensure all data is current
      await fetchRewardDefinitions();
      
      // Reset form and editing state
      resetFormAndEditingState();
      setError(null);
      alert('Reward updated successfully!');

    } catch (err: any) {
      console.error("[handleUpdateReward] Error:", err);
      setError(err.message || "Failed to update reward");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteReward = async (rewardId: string) => {
    if (!window.confirm('Are you sure you want to delete this reward definition? This cannot be undone.')) {
      return;
    }
    setIsLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error("Authentication token missing.");
      }

      const response = await fetch(`http://localhost:3001/api/rewards/definitions/${rewardId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        let errorMessage = `Failed to delete reward. Status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // If not JSON, use the default error message
        }
        throw new Error(errorMessage);
      }

      // Remove from state
      setRewardDefinitions(prev => prev.filter(r => r.reward_id !== rewardId));
      
      // Clear form if we were editing this reward
      if (editingRewardId === rewardId) {
        resetFormAndEditingState();
      }
      
      alert('Reward deleted successfully!');

    } catch (err: any) {
      console.error("Error deleting reward:", err);
      setError(err.message || 'An unknown error occurred while deleting the reward.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGrantVoucher = () => {
    if (!loggedInUser?.internalId) {
      alert("Cannot grant voucher: User not logged in.");
      return;
    }
    
    // Check if we have rewards available to grant
    if (rewardDefinitions.length === 0) {
      alert("No rewards available to grant. Please create rewards first.");
      return;
    }
    
    // First select a customer
    setSelectedCustomer(null);
    setSelectedReward(null);
    setShowUserSelectModal(true);
    setGrantSuccessMessage(null);
  };

  const handleCustomerSelected = (user: User) => {
    setSelectedCustomer(user);
    setShowUserSelectModal(false);
    
    // Now proceed with reward selection
    showRewardSelection(user);
  };

  const showRewardSelection = (customer: User) => {
    // If we're in edit mode and have a selected reward, use that one
    if (editingRewardId && formState.name) {
      setSelectedReward({
        id: editingRewardId,
        name: formState.name
      });
      setShowNotesModal(true);
    } else {
      // Otherwise show the reward selection modal
      setShowRewardSelectModal(true);
    }
  };

  const handleRewardSelected = (rewardId: string, rewardName: string) => {
    setSelectedReward({
      id: rewardId,
      name: rewardName
    });
    setShowRewardSelectModal(false);
    setShowNotesModal(true);
  };

  const handleNotesSubmitted = (notes: string) => {
    setShowNotesModal(false);
    
    if (selectedCustomer && selectedReward) {
      proceedWithGranting(
        selectedCustomer.internalId, 
        selectedReward.id, 
        selectedReward.name,
        notes
      );
    }
  };

  const proceedWithGranting = async (customerId: string, rewardId: string, rewardName: string, notes?: string) => {
    // Show a loading indicator or disable UI elements here if needed
    setIsLoading(true);
    
    // Call the grant function
    try {
      const result = await grantVoucherFunction(
        customerId, 
        rewardId, 
        loggedInUser?.internalId || '', 
        notes
      );
      
      // Prepare a more detailed success message
      let successMessage = `Voucher "${rewardName}" has been granted successfully!`;
      
      // Add expiry date info if available
      if (result && result.expiryDate) {
        const expiryDate = new Date(result.expiryDate);
        const formattedDate = expiryDate.toLocaleDateString();
        successMessage += `\nExpires on: ${formattedDate}`;
      }
      
      // Add info about included products if available
      if (result && result.includedProducts && result.includedProducts.length > 0) {
        const productNames = result.includedProducts.map((p: any) => p.name).join(", ");
        successMessage += `\nIncludes: ${productNames}`;
      }
      
      setGrantSuccessMessage(successMessage);
      
      // Refresh the rewards list to show updated data
      fetchRewardDefinitions();
    } catch (error) {
      console.error("Error in grant voucher function:", error);
      setError(`Failed to grant voucher: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Fetch Products ---
  const fetchProducts = async () => {
    setProductsLoading(true);
    setProductsError(null);
    try {
      const token = localStorage.getItem('authToken');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        console.warn("[EditRewards.tsx] Auth token not found for fetching products.");
        // Depending on requirements, you might want to throw an error or redirect
        // throw new Error("Authentication token missing."); 
      }

      const response = await fetch('http://localhost:3001/api/products', {
        headers: headers,
      });

      if (!response.ok) {
        let errorDetail = `Failed to fetch products. Status: ${response.status}`;
         try {
            const errorData = await response.json();
            errorDetail = errorData.message || errorDetail;
         } catch (e) {
            // Ignore parsing error if response is not JSON
         }
        throw new Error(errorDetail);
      }
        
      let productData;
      try {
        productData = await response.json();
      } catch (error) {
        console.error("Error parsing products response:", error);
        throw new Error("Invalid response format from server");
      }

      // Ensure we have a valid array of products and add safeguards
      const validatedProducts = Array.isArray(productData) 
        ? productData.map(p => {
            if (!p) return null;
            // Ensure each product has at least the required fields
            return {
              id: p.id || p.product_id || `unknown-${Date.now()}`,
              name: p.name || 'Unknown Product',
              price: typeof p.price === 'number' ? p.price : 
                    typeof p.base_price === 'number' ? p.base_price : 0,
              image: p.image || p.image_url || '/src/assets/product.png',
              category: p.category || p.category_name || 'Uncategorized',
              description: p.description || '',
              availability: p.availability || 'available',
              tags: Array.isArray(p.tags) ? p.tags : [],
              optionCategories: Array.isArray(p.optionCategories) ? p.optionCategories : []
            } as Product;
          }).filter(Boolean) as Product[] // Remove any null entries and cast to Product[]
        : [];

      setProducts(validatedProducts);
      console.log("Fetched products:", validatedProducts); // Log fetched data

    } catch (err: any) {
      console.error("Failed to fetch products:", err);
      setProductsError(err.message || 'An unknown error occurred while fetching products.');
      // Set an empty array to prevent null reference errors elsewhere
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  // Fetch products on component mount
  useEffect(() => {
    fetchProducts();
  }, []); // Empty dependency array means this runs once on mount

  // --- Product Selection Handler ---
  const handleProductSelectionChange = (field: keyof RewardFormState, selectedIds: string[]) => {
    try {
      // Ensure selectedIds is always a valid array
      const validIds = Array.isArray(selectedIds) 
        ? selectedIds.filter(id => id !== null && id !== undefined && id !== '')
        : [];
      
      console.log(`[handleProductSelectionChange] Field: ${field}, Selected IDs:`, validIds);
      
      // Update form state with the validated IDs
      dispatch({ 
        type: 'SET_FIELD', 
        field, 
        value: validIds
      });
    } catch (error) {
      console.error(`Error updating product selection for ${field}:`, error);
      // In case of error, don't update state to avoid crashes
    }
  };

  const handleCancelClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      handleCancelEdit();
  };

  const handleAddNewRewardClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (editingRewardId) {
          handleCancelEdit();
      } else {
          setIsAddingNewReward(true);
          dispatch({ type: 'RESET_FORM' });
          setError(null);
          setIsLoading(false);
      }
  };

  // --- Render Logic ---
  if (rewardDefinitionsLoading) {
    return <div className="p-6 text-center text-gray-500">Loading reward definitions and products...</div>;
  }

  if (rewardDefinitionsError) {
    return <div className="p-6 text-center text-red-500">Error loading reward definitions: {rewardDefinitionsError} <button onClick={fetchRewardDefinitions} className="ml-2 px-2 py-1 bg-blue-500 text-white rounded">Retry Rewards</button></div>;
  }
   if (productsError && !rewardDefinitionsLoading) { // Show products error if not already showing rewards error
    return <div className="p-6 text-center text-red-500">Error loading products: {productsError} <button onClick={fetchProducts} className="ml-2 px-2 py-1 bg-blue-500 text-white rounded">Retry Products</button></div>;
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-theme(space.24))]">
      {/* Left Panel: Reward List */}
      <div className="w-1/3 bg-white rounded-2xl p-5 shadow-lg flex flex-col border border-gray-100">
          <div className="flex justify-between items-center mb-5">
               <h2 className="text-xl font-semibold text-gray-800">Reward Definitions</h2>
                <button 
                    onClick={handleAddNewRewardClick}
                    className="quick-action-button" 
                    disabled={isLoading}
                >
                    {editingRewardId ? 'Cancel Edit' : '+ Add New Reward'}
                </button>
          </div>
          
          {/* Success message for grant voucher */}
          {grantSuccessMessage && (
            <div className="mb-4 p-3 bg-green-100 border border-green-300 text-green-800 rounded-md text-sm">
              {grantSuccessMessage}
              <button 
                onClick={() => setGrantSuccessMessage(null)} 
                className="ml-2 text-green-700 hover:text-green-900"
              >
                ✕
              </button>
            </div>
          )}
          
          <ul className="space-y-2 overflow-y-auto flex-1 pr-1 styled-scrollbar">
              {rewardDefinitions.map((reward) => (
                  <li
                      key={reward.reward_id || `reward-${reward.name}`}
                      onClick={() => handleStartEdit(reward)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors hover:bg-amber-50 ${
                          editingRewardId === reward.reward_id ? 'bg-amber-100 border border-amber-300' : 'border border-transparent'
                      }`}
                  >
                       <div className="flex items-center">
                          <div className="flex-1">
                              <h3 className="font-medium text-gray-900">{reward.name}</h3>
                              <p className="text-sm text-gray-500">{reward.description}</p>
                            </div>
                        </div>
                  </li>
              ))}
               {rewardDefinitions.length === 0 && (
                   <p className="text-sm text-gray-400 text-center py-4">No reward definitions found.</p>
               )}
                </ul>
           {/* Optional: Grant Voucher Button */}
          <div className="mt-4 border-t border-gray-100 pt-4">
              <button 
                onClick={handleGrantVoucher} 
                className="quick-action-button w-full justify-center bg-blue-100 text-blue-700 hover:bg-blue-200"
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 'Grant Voucher Manually'}
              </button>
          </div>
      </div>

      {/* Right Panel: Add/Edit Form */}
      <div className="flex-1 bg-white rounded-2xl p-6 shadow-lg border border-gray-100 overflow-y-auto styled-scrollbar">
          {(editingRewardId !== null || isAddingNewReward) ? (
              <form onSubmit={(e) => {
                  e.preventDefault();
                  if (editingRewardId !== null) {
                      handleUpdateReward();
                  } else {
                      handleAddReward();
                  }
              }}>
                  <div className="flex justify-between items-start">
                      <div className="space-y-1">
                          <h2 className="text-2xl font-semibold text-gray-800">
                              {isAddingNewReward ? 'Add New Reward' : editingRewardId ? 'Edit Reward' : 'Select a Reward'}
                          </h2>
                          {(isAddingNewReward || editingRewardId) && (
                              <p className="text-sm text-gray-500">Fill in the reward details below</p>
                          )}
                      </div>
                      <div className="flex space-x-2">
                          <button
                              type="button"
                              onClick={handleCancelClick}
                              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                              disabled={isLoading}
                          >
                              Cancel
                          </button>
                          {editingRewardId && (
                              <button
                                  type="button"
                                  onClick={() => {
                                      if (editingRewardId) {
                                          handleDeleteReward(editingRewardId);
                                      }
                                  }}
                                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                                  disabled={isLoading}
                              >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  Delete
                              </button>
                          )}
                          <button
                              type="submit"
                              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
                              disabled={isLoading}
                          >
                              {isLoading ? 'Saving...' : (isAddingNewReward ? 'Add Reward' : 'Save Changes')}
                          </button>
                      </div>
                  </div>

                  {error && (
                      <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-800 rounded-md text-sm">
                          {error}
            </div>
         )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                          <FormGroup label="Reward Image">
                              <ImageUpload
                                  currentImageUrl={formState.image}
                                  defaultImageUrl="/src/assets/rewards.png"
                                  onImageChange={handleImageChange}
                                  disabled={isLoading}
                                  className="w-full aspect-square"
                              />
                          </FormGroup>
                      <FormGroup label="Reward Name*">
                          <input type="text" name="name" value={formState.name} onChange={handleInputChange} className="form-input" required disabled={isLoading} />
          </FormGroup>
          <FormGroup label="Type*">
                          <select name="type" value={formState.type} onChange={handleInputChange} className="form-select" required disabled={isLoading}>
                              <option value="standard">Standard (Points Redemption / Direct Benefit)</option>
                              <option value="voucher">Voucher (Claimable Instance)</option>
                              <option value="discount_coupon">Discount Coupon (Apply at Checkout)</option>
                              <option value="loyalty_tier_perk">Loyalty Tier Perk (Tier Benefit)</option>
                              <option value="manual_grant">Manual Grant (Admin Only)</option>
            </select>
          </FormGroup>
                       <FormGroup label="Description">
                          <textarea name="description" value={formState.description} onChange={handleInputChange} className="form-input" rows={3} disabled={isLoading} />
          </FormGroup>
                       <FormGroup label="Earning Hint">
                          <input type="text" name="earningHint" value={formState.earningHint} onChange={handleInputChange} className="form-input" disabled={isLoading} />
          </FormGroup>
                      </div>
                           <div className="space-y-4">
                                   <FormGroup label="Points Cost (required if not free/discount)">
                                       <input type="number" name="pointsCost" value={formState.pointsCost} onChange={handleInputChange} className="form-input" step="1" min="0" disabled={isLoading} />
          </FormGroup>
                                    <FormGroup label="Free Menu Items">
                                          <ProductMultiSelect
                                              products={products}
                                              selectedProductIds={formState.freeMenuItemIds}
                                              onChange={(selectedIds) => handleProductSelectionChange('freeMenuItemIds', selectedIds)}
                                              disabled={isLoading}
                                  productsLoading={productsLoading}
                                  productsError={productsError}
                                          />
                                      </FormGroup>
                                         <FormGroup label="Discount Percentage (e.g., 10 for 10%)">
                                             <input type="number" name="discountPercentage" value={formState.discountPercentage} onChange={handleInputChange} className="form-input" step="0.1" min="0" max="100" disabled={isLoading} />
          </FormGroup>
                                         <FormGroup label="Discount Fixed Amount (e.g., 5 for $5)">
                                             <input type="number" name="discountFixedAmount" value={formState.discountFixedAmount} onChange={handleInputChange} className="form-input" step="0.01" min="0" disabled={isLoading} />
          </FormGroup>
                           </div>
        </div>

                      {/* Criteria Section */}
                  {formState.type !== 'manual_grant' && (
                         <div className="pt-4 border-t border-gray-200">
                            <h3 className="text-md font-semibold text-gray-700 mb-3">Earning Criteria (How to earn this reward - leave blank for no criteria)</h3>
                            <div className="space-y-4">
                                <FormGroup label="Minimum Spend">
                                    <input type="number" name="criteria_minSpend" value={formState.criteria_minSpend} onChange={handleInputChange} className="form-input" step="0.01" min="0" disabled={isLoading} />
          </FormGroup>
                                <FormGroup label="Minimum Points">
                                    <input type="number" name="criteria_minPoints" value={formState.criteria_minPoints} onChange={handleInputChange} className="form-input" step="1" min="0" disabled={isLoading} />
          </FormGroup>
                                 <FormGroup label="Required Product(s)">
                                       <ProductMultiSelect
                                              products={products}
                                              selectedProductIds={formState.criteria_requiredProductIds}
                                              onChange={(selectedIds) => handleProductSelectionChange('criteria_requiredProductIds', selectedIds)}
                                              disabled={isLoading}
                                      productsLoading={productsLoading}
                                      productsError={productsError}
                                          />
                                   </FormGroup>
                                 <FormGroup label="Excluded Product(s)">
                                       <ProductMultiSelect
                                              products={products}
                                              selectedProductIds={formState.criteria_excludedProductIds}
                                              onChange={(selectedIds) => handleProductSelectionChange('criteria_excludedProductIds', selectedIds)}
                                              disabled={isLoading}
                                      productsLoading={productsLoading}
                                      productsError={productsError}
                                          />
                                   </FormGroup>
                                  <FormGroup label="Requires Specific Product(s) (Exactly These)">
                                       <ProductMultiSelect
                                              products={products}
                                              selectedProductIds={formState.criteria_requiresSpecificProductIds}
                                              onChange={(selectedIds) => handleProductSelectionChange('criteria_requiresSpecificProductIds', selectedIds)}
                                              disabled={isLoading}
                                      productsLoading={productsLoading}
                                      productsError={productsError}
                                          />
                                   </FormGroup>
                                  <FormGroup label="Requires Product Category (by name)">
                                     <input type="text" name="criteria_requiresProductCategory" value={formState.criteria_requiresProductCategory} onChange={handleInputChange} className="form-input" placeholder="e.g., Coffee" disabled={isLoading} />
          </FormGroup>
                                 <FormGroup label="Minimum Purchases Monthly">
                                     <input type="number" name="criteria_minPurchasesMonthly" value={formState.criteria_minPurchasesMonthly} onChange={handleInputChange} className="form-input" step="1" min="0" disabled={isLoading} />
          </FormGroup>
                                <FormGroup label="Allowed Days of Week (comma-separated numbers, 0=Sun, 6=Sat)">
                                     <input type="text" name="criteria_allowedDaysOfWeek" value={formState.criteria_allowedDaysOfWeek} onChange={handleInputChange} className="form-input" placeholder="e.g., 1,2,3 for Mon,Tue,Wed" disabled={isLoading} />
          </FormGroup>
                                  <FormGroup label="Active Time Windows (JSON array of {startTime: 'HH:MM', endTime: 'HH:MM', daysOfWeek?: number[]})">
                                      <textarea name="criteria_activeTimeWindows" value={formState.criteria_activeTimeWindows} onChange={handleInputChange} className="form-input text-xs" rows={2} placeholder='e.g., [{"startTime":"09:00","endTime":"11:00","daysOfWeek":[1,2,3]},{"startTime":"14:00","endTime":"16:00"}]' disabled={isLoading} />
          </FormGroup>
                                <FormGroup label="Required Customer Tier (comma-separated names)">
                                     <input type="text" name="criteria_requiredCustomerTier" value={formState.criteria_requiredCustomerTier} onChange={handleInputChange} className="form-input" placeholder="e.g., Gold, Silver" disabled={isLoading} />
          </FormGroup>
                                <FormGroup label="Minimum Referrals">
                                     <input type="number" name="criteria_minReferrals" value={formState.criteria_minReferrals} onChange={handleInputChange} className="form-input" step="1" min="0" disabled={isLoading} />
          </FormGroup>
          <FormGroup label="Valid Start Date (YYYY-MM-DD)">
                                     <input type="date" name="criteria_validStartDate" value={formState.criteria_validStartDate} onChange={handleInputChange} className="form-input" disabled={isLoading} />
          </FormGroup>
          <FormGroup label="Valid End Date (YYYY-MM-DD)">
                                     <input type="date" name="criteria_validEndDate" value={formState.criteria_validEndDate} onChange={handleInputChange} className="form-input" disabled={isLoading} />
                                 </FormGroup>
                                  <FormGroup label="Cumulative Spend Total (Lifetime)">
                                     <input type="number" name="criteria_cumulativeSpendTotal" value={formState.criteria_cumulativeSpendTotal} onChange={handleInputChange} className="form-input" step="0.01" min="0" disabled={isLoading} />
                                 </FormGroup>
                                  <FormGroup label="Minimum Spend Per Transaction">
                                     <input type="number" name="criteria_minSpendPerTransaction" value={formState.criteria_minSpendPerTransaction} onChange={handleInputChange} className="form-input" step="0.01" min="0" disabled={isLoading} />
          </FormGroup>
        </div>
        </div>
                       )}
               </form>
           ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.707-8.707z" /></svg>
                  <p>Select a reward from the list to edit, or click <button onClick={handleAddNewRewardClick} className="text-blue-600 hover:underline">"Add New Reward"</button> to create a new one.</p>
                </div>
        )}
      </div>

      {/* User Select Modal */}
      <UserSelectModal 
        isOpen={showUserSelectModal}
        onClose={() => setShowUserSelectModal(false)}
        onSelectUser={handleCustomerSelected}
      />

      {/* Reward Select Modal */}
      <RewardSelectModal 
        isOpen={showRewardSelectModal}
        onClose={() => setShowRewardSelectModal(false)}
        onSelectReward={handleRewardSelected}
        rewards={rewardDefinitions}
        selectedCustomer={selectedCustomer}
      />

      {/* Notes Modal */}
      <NotesModal 
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        onSubmit={handleNotesSubmitted}
        selectedCustomer={selectedCustomer}
        selectedReward={selectedReward}
      />
    </div>
  );
};

const FormGroup: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
    <div className={className}>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        {children}
    </div>
);

interface ProductMultiSelectProps {
    products: Product[];
    selectedProductIds: string[];
    onChange: (selectedIds: string[]) => void;
    disabled?: boolean;
    productsLoading: boolean;
    productsError: string | null;
}

const ProductMultiSelect: React.FC<ProductMultiSelectProps> = ({
    products,
    selectedProductIds,
    onChange,
    disabled,
    productsLoading,
    productsError
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Use a safer version of selectedProductIds that's guaranteed to be an array
    const safeSelectedIds = useMemo(() => {
        if (!selectedProductIds || !Array.isArray(selectedProductIds)) {
            console.warn("ProductMultiSelect received invalid selectedProductIds:", selectedProductIds);
            return [];
        }
        return selectedProductIds.filter(id => id !== null && id !== undefined && id !== "");
    }, [selectedProductIds]);

    // Extract unique categories from products with defensive error handling
    const categories = useMemo(() => {
        if (!products || !Array.isArray(products)) {
            return ['All'];
        }
        try {
            const uniqueCategories = new Set<string>();
            products.forEach(product => {
                if (product && product.category) {
                    uniqueCategories.add(product.category);
                }
            });
            return ['All', ...Array.from(uniqueCategories)].sort();
        } catch (error) {
            console.error("Error extracting categories:", error);
            return ['All'];
        }
    }, [products]);

    // Filter products by search term and category with defensive programming
    const filteredProducts = useMemo(() => {
        if (!products || !Array.isArray(products)) {
            return [];
        }
        try {
            return products.filter(product => {
                if (!product) return false;
                
                const matchesSearch = !searchTerm || 
                    (product.name && product.name.toLowerCase().includes(searchTerm.toLowerCase())) || 
                    (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()));
                
                const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
                
                return matchesSearch && matchesCategory;
            });
        } catch (error) {
            console.error("Error filtering products:", error);
            return [];
        }
    }, [products, searchTerm, selectedCategory]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleProductClick = (e: React.MouseEvent, productId: string) => {
        e.preventDefault();
        if (!disabled && productId) {
            try {
                // Create a defensive copy of safeSelectedIds
                const currentSelection = [...safeSelectedIds];
                
                // Update the selection safely
                let newSelectedIds: string[];
                if (currentSelection.includes(productId)) {
                    newSelectedIds = currentSelection.filter(id => id !== productId);
                } else {
                    newSelectedIds = [...currentSelection, productId];
                }
                
                // Ensure we always return a valid array
                onChange(newSelectedIds.filter(Boolean));
            } catch (error) {
                console.error("Error selecting product:", error);
                // If an error occurs, don't change the selection
                onChange([...safeSelectedIds]);
            }
        }
    };
    
    const getSelectedProductNames = () => {
        try {
            if (!products || !Array.isArray(products) || !safeSelectedIds.length) {
                return '';
            }
            
            const selectedNames = safeSelectedIds
                .map(id => {
                    const product = products.find(p => p && p.id === id);
                    return product ? product.name : 'Unknown Product';
                })
                .filter(Boolean)
                .join(', ');
                
            return selectedNames;
        } catch (error) {
            console.error("Error getting product names:", error);
            return 'Selected products';
        }
    };

    if (productsLoading) {
        return <div className="text-gray-500">Loading products...</div>;
    }

    if (productsError) {
        return <div className="text-red-500">Error: {productsError}</div>;
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                type="button" 
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full px-3 py-2 text-left border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white cursor-pointer hover:bg-gray-50'
                }`}
                disabled={disabled}
            >
                <span className={safeSelectedIds.length === 0 ? 'text-gray-400' : 'text-gray-700'}>
                    {safeSelectedIds.length > 0 
                        ? `${safeSelectedIds.length} selected: ${getSelectedProductNames()}` 
                        : 'Select products...'}
                </span>
            </button>
            {isOpen && !disabled && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-96 flex flex-col">
                    {/* Search and category filter */}
                    <div className="p-2 border-b sticky top-0 bg-white z-20">
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-1.5 border rounded-lg text-sm mb-2"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex flex-wrap gap-1 mt-1">
                            {categories.map(category => (
                                <button
                                    key={category}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedCategory(category);
                                    }}
                                    className={`px-2 py-1 text-xs rounded-md ${
                                        selectedCategory === category
                                            ? 'bg-emerald-100 text-emerald-800 font-medium'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {/* Product list */}
                    <div className="overflow-y-auto max-h-72">
                        {filteredProducts.length === 0 ? (
                            <div className="p-3 text-gray-500 text-center">
                                {searchTerm 
                                    ? `No products matching "${searchTerm}" in ${selectedCategory !== 'All' ? selectedCategory : 'any'} category`
                                    : selectedCategory !== 'All' 
                                        ? `No products in ${selectedCategory} category` 
                                        : 'No products available'}
                            </div>
                        ) : (
                            filteredProducts.map((product) => {
                                // Skip rendering if product is invalid
                                if (!product || !product.id) return null;
                                
                                const isSelected = safeSelectedIds.includes(product.id);
                                
                                return (
                                    <div
                                        key={`product-${product.id}`}
                                        onClick={(e) => handleProductClick(e, product.id)}
                                        className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${
                                            isSelected ? 'bg-blue-50' : ''
                                        }`}
                                    >
                                        <div className="flex items-center">
                                            {product.image && (
                                                <img 
                                                    src={product.image} 
                                                    alt={product.name} 
                                                    className="w-8 h-8 rounded-sm object-cover mr-2"
                                                    onError={(e) => {
                                                        // Handle image load errors
                                                        (e.target as HTMLImageElement).src = '/src/assets/product.png';
                                                    }}
                                                />
                                            )}
                                            <div className="flex-grow">
                                                <div className="text-sm font-medium text-gray-700">{product.name}</div>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs text-emerald-600 font-medium">
                                                        ${product.price?.toFixed(2) || "0.00"}
                                                    </span>
                                                    {product.category && (
                                                        <span className="text-xs text-gray-500 italic">
                                                            {product.category}
                                                        </span>
                                                    )}
                                                </div>
                                                {product.description && (
                                                    <div className="text-xs text-gray-500 line-clamp-1">{product.description}</div>
                                                )}
                                            </div>
                                            <div className="flex-shrink-0 w-6">
                                                {isSelected && (
                                                    <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    
                    {/* Controls */}
                    <div className="p-2 border-t bg-gray-50 mt-auto flex justify-between">
                        <span className="text-sm text-gray-600">
                            {safeSelectedIds.length} products selected
                        </span>
                        <div className="flex gap-2">
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange([]);
                                }}
                                className="px-2 py-1 text-xs text-gray-600 hover:text-red-600"
                            >
                                Clear
                            </button>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsOpen(false);
                                }}
                                className="px-3 py-1 text-xs bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EditRewards; 