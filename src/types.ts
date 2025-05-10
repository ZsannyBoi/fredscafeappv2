export interface User {
  id: string; // Email
  name: string;
  role: 'manager' | 'employee' | 'cashier' | 'cook' | 'customer';
  referralCode?: string; // Added for referral system
  avatar?: string; // Added for user avatar
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
  id: string;
  name: string;
  description?: string; // More detailed explanation of the reward
  image: string;
  type: 'standard' | 'voucher' | 'discount_coupon' | 'loyalty_tier_perk' | 'manual_grant';
  
  criteria?: RawRewardItemCriteria; // Criteria to EARN/BE ELIGIBLE for this reward. Optional for manually granted rewards.
  
  // What the reward GIVES when claimed/applied
  pointsCost?: number; // How many points it costs to claim this reward (if it's a point redemption)
  freeMenuItemIds?: string[]; // IDs of menu items given for free
  discountPercentage?: number; // e.g., 10 for 10%
  discountFixedAmount?: number; // e.g., 5 for $5 off
  // For loyalty_tier_perk, the benefit might be intrinsic to the tier (e.g. permanent 5% discount)

  earningHint?: string; // Textual hint on how to earn or use
  // Removed: size, color, addOns, quantity - these should be part of product details if reward is a specific product.
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

export interface PlacedOrderItemDetail {
  productId: string;
  name: string; // Keep name for potential backend cross-check or logging
  quantity: number;
  selectedOptionIds: Record<string, string | string[]>; // e.g., { '1': '3', '4': ['11', '12'] } (groupId: optionId | optionIds)
}

export interface NewOrderData {
  customerName: string;
  items: PlacedOrderItemDetail[];
}

// --- Application Settings Type ---
export interface SettingsData {
    notifications: {
        email: boolean;
        sms: boolean;
    };
    theme: 'light' | 'dark'; // Could be expanded with 'system' later
    profileBanner: {
        type: 'color' | 'image';
        value: string; // Hex color code or image URL/path (could be blob URL for preview)
    };
    // Add other global or user-specific settings here as needed
}

// --- Product and Menu Related Types ---
export interface ProductOption {
  id?: string; // Optional: Unique ID for managing options in forms (e.g., EditMenu)
  label: string;
  // value?: string; 
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
  availability?: 'available' | 'unavailable' | 'limited'; 
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
  phone?: string;
  hireDate?: string; // ISO Date string (e.g., "YYYY-MM-DD")
  // Add other relevant details like emergencyContact, payRate, etc. if needed for the system.
}

export interface EmployeeFormDetails {
  employeeId: string;
  position: EmployeeData['position']; // Use the position type from EmployeeData
  phone?: string;
  status: EmployeeData['status']; // Use the status type from EmployeeData
  hireDate?: string;
  role?: User['role']; // Added for managing user's system role
} 