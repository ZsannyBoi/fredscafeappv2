export interface User {
  internalId: string; // A stable, non-sensitive identifier for API calls
  email: string; // User's email address (used for login and display)
  name: string;
  role: 'manager' | 'employee' | 'cashier' | 'cook' | 'customer';
  referralCode?: string; // Added for referral system
  avatar?: string; // Added for user avatar
  phone_number?: string; // Add phone_number to User interface
  address?: string; // Add address to User interface
}

// Interface for time-based reward availability
export interface TimeWindow {
  startTime: string; // e.g., "09:00" (24-hour format)
  endTime: string;   // e.g., "17:30"
  daysOfWeek?: number[]; // Optional: 0 for Sunday, 1 for Monday, ..., 6 for Saturday
}

// --- Enhanced Reward System Types ---

export interface RawRewardItemCriteria {
  minSpend?: number;
  minPoints?: number;
  requiredProductIds?: string[];
  excludedProductIds?: string[];
  isBirthMonthOnly?: boolean;
  isBirthdayOnly?: boolean;
  minPurchasesMonthly?: number;
  allowedDaysOfWeek?: number[]; // 0 for Sunday, 6 for Saturday
  activeTimeWindows?: TimeWindow[];
  requiredCustomerTier?: string[];
  isSignUpBonus?: boolean;
  isReferralBonusForNewUser?: boolean; // Added for referral system
  isRewardForReferringUser?: boolean;  // Added for referral system
  minReferrals?: number;
  validDateRange?: { startDate?: string; endDate?: string; };
  cumulativeSpendTotal?: number;
  minSpendPerTransaction?: number;
  requiresSpecificProductIds?: string[];
  requiresProductCategory?: string;
}

export interface RawRewardItem {
  reward_id: string; // Primary identifier
  name: string;
  description?: string;
  image_url?: string;
  type: 'standard' | 'voucher' | 'discount_coupon' | 'loyalty_tier_perk' | 'manual_grant';

  // Fields from criteria_json (will be parsed on frontend)
  criteria_json?: string;

  // What the reward GIVES when claimed/applied
  points_cost?: number;
  free_menu_item_ids?: string[]; // Always an array when present
  discount_percentage?: number;
  discount_fixed_amount?: number;
  earning_hint?: string;

  // Timestamps from backend
  created_at?: string;
  updated_at?: string;
}

// Interface for reward data AFTER fetching and processing (camelCase for frontend use)
export interface ProcessedRewardItem {
    id: string; // Frontend ID, typically mapped from backend's reward_id
    reward_id: string; // Keep backend ID for clarity if needed
    name: string;
    description?: string;
    image: string; // Mapped from image_url, using frontend name
    type: RawRewardItem['type'];
    pointsCost?: number; // Mapped from points_cost
    discountPercentage?: number; // Mapped from discount_percentage
    discountFixedAmount?: number; // Mapped from discount_fixed_amount
    earningHint?: string; // Mapped from earning_hint
    criteria?: RawRewardItemCriteria; // Parsed criteria object
    freeMenuItemIds: string[]; // Mapped from free_menu_item_ids (as an array)
    // Add other processed fields here as needed (e.g., dates)
}

export interface CustomerVoucher {
  instanceId: string; // Unique ID for this specific voucher instance for this customer
  rewardId: string;     // Which RawRewardItem this voucher corresponds to
  customerId: string;   // Link voucher to a customer
  name: string;         // Copied from RawRewardItem for display convenience
  description?: string;  // Copied
  grantedDate: string;  // ISO Date string
  expiryDate?: string;   // ISO Date string, optional
  status: 'active' | 'claimed' | 'expired';
  grantedBy: 'system_earned' | 'employee_granted' | 'signup_bonus';
  employeeGrantDetails?: { employeeId: string; notes?: string }; // If granted by employee
}

export interface CustomerInfo {
  name: string; // Display name from profile or entered
  id: string;   // Customer's unique User ID
  avatar?: string;
  birthDate?: string; // YYYY-MM-DD

  // Tracking for reward eligibility
  loyaltyPoints: number;
  purchasesThisMonth: number;
  lifetimeTotalSpend?: number;
  lifetimeTotalVisits?: number; // A visit could be one order
  // spendThisPeriod & visitsThisPeriod would need defined period (e.g. for 'cumulativeSpendTotal' criteria)
  // For now, assume lifetimeTotalSpend and lifetimeTotalVisits cover these broader cumulative criteria.

  membershipTier?: string; // e.g., 'Bronze', 'Silver', 'Gold'
  tierJoinDate?: string; // ISO Date string
  
  joinDate?: string; // ISO Date string (for sign-up bonus)
  referralsMade?: number;

  // Vouchers/coupons currently held by the customer
  activeVouchers?: CustomerVoucher[];
  claimedGeneralRewardIds?: string[]; // Added: IDs of general rewards already claimed by the customer
}

// --- Existing Order & App Types (customerId already added to OrderItem) ---
export interface OrderItem {
  id: string;
  customerId: string;
  customerName: string; 
  items: {
    name: string;
    quantity: number;
    customizations: { group: string; option: string }[];
  }[];
  total: number;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  timestamp: string;
  ticketNumber: string;
}

export interface OrderResponse {
  id: string;
  orderId?: string;
  timestamp: string;
  ticketNumber: string;
}

export interface PlacedOrderItemDetail {
  productId: string;
  name: string;
  quantity: number;
  selectedOptionIds: Record<string, string | string[]>;
  isRewardItem?: boolean; // Whether this is a free item from a reward
  rewardId?: string; // The reward this item is associated with
  price?: number; // Include original price for reference when it's a free item
  unitPriceSnapshot?: number; // Price per item including options
  selectedOptionsSnapshot?: { group: string, option: string }[]; // Array of option details
}

export interface NewOrderData {
  customerName: string;
  items: PlacedOrderItemDetail[];
  redeemedRewards?: RedeemedReward[]; // Rewards that were applied to this order
  userId?: string;
}

// Type for rewards applied to an order
export interface RedeemedReward {
  rewardId: string;
  rewardType: string;
  voucherId?: string; // For voucher rewards
  appliedDiscount?: {
    type: 'percentage' | 'fixed';
    value: number;
    originalTotal: number;
    discountedTotal: number;
  };
  freeItems?: string[]; // Product IDs of free items
}

// Available rewards for a customer to choose from during checkout
export interface AvailableReward {
  id: string;
  name: string;
  description?: string;
  type: RawRewardItem['type'];
  pointsCost?: number;
  discountPercentage?: number;
  discountFixedAmount?: number;
  freeMenuItemIds?: string[];
  isVoucher?: boolean;
  instanceId?: string; // For vouchers
  image?: string;
}

// --- Application Settings Type ---
export interface SettingsData {
    autoSave: boolean;
    theme: 'light' | 'dark'; // Could be expanded with 'system' later
    profileBanner: {
        type: 'color' | 'image';
        value: string; // Hex color code or image URL/path (could be blob URL for preview)
    };
    // Add other global or user-specific settings here as needed
}

// --- Product and Menu Related Types ---
export interface ProductOption {
  id: string; // Optional: Unique ID for managing options in forms (e.g., EditMenu)
  label: string;
  value?: string; // Added/uncommented: Optional value for the option
  priceModifier?: number; // Optional: e.g., +$0.50 for Almond Milk
}

export interface OptionCategory {
    id: string; // Unique ID for the category (e.g., "size", "milk", or uuid)
    name: string; // Display name (e.g., "Size", "Milk Type")
    image?: string; // Optional image for the category
    selectionType: 'radio' | 'checkbox'; // How options are selected
    is_required: boolean; // Added is_required
    options: ProductOption[];
}

export interface Product {
  id: string; 
  name: string;
  price: number; // Base price
  image: string; 
  category: string; // Use string to allow dynamic category creation/editing
  description?: string; 
  optionCategories?: OptionCategory[]; 
  availability?: 'available' | 'unavailable'; // Removed 'limited'
  tags?: string[]; 
}

// Type for OptionGroup as fetched from/sent to backend
export interface BackendOptionGroup {
  option_group_id: number;
  name: string;
  selection_type: 'radio' | 'checkbox';
  is_required: boolean; // Added is_required
  // created_at and updated_at are also present but usually not directly managed by frontend forms
}

// --- Employee Management Types ---
export interface EmployeeData {
  id: string; // Internal unique ID for React keys, etc.
  employeeId: string; // Official, possibly user-facing Employee ID
  employeeName: string;
  // Consider using a more specific UserRoleType if these roles align with User.role
  // Or keep as a separate set of job positions if distinct.
  position: 'Manager' | 'Barista' | 'Cashier' | 'Cook' | 'Shift Lead' | 'Other'; 
  status: 'Active' | 'Inactive';
  email?: string;
  hireDate?: string; // ISO Date string (e.g., "YYYY-MM-DD")
  // Add other relevant details like emergencyContact, payRate, etc. if needed for the system.
}

export interface EmployeeFormDetails {
  employeeId: string;
  position: EmployeeData['position']; // Use the position type from EmployeeData
  status: EmployeeData['status']; // Use the status type from EmployeeData
  hireDate?: string;
  role?: User['role']; // Added for managing user's system role
} 