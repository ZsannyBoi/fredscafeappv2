import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Product, OptionCategory, OrderItem as CartItem, User, ProductOption, NewOrderData, OrderItem, PlacedOrderItemDetail, RedeemedReward } from '../types'; // Added OrderItem for clarity
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// --- Types --- 
interface AvailableReward {
  id: string;
  name: string;
  description?: string;
  image?: string;
  type: 'standard' | 'voucher' | 'discount_coupon' | 'loyalty_tier_perk' | 'manual_grant';
  pointsCost?: number;
  freeMenuItemIds?: string[];
  discountPercentage?: number;
  discountFixedAmount?: number;
  isVoucher: boolean;
  instanceId?: string; // For vouchers
  isClaimed?: boolean; // To indicate it's a reward the user possesses
  expiryDate?: string; // For vouchers
  isNewlyRedeemed?: boolean; // Flag for rewards that were just claimed
  isEligible?: boolean; // Whether the user is eligible for this reward
  ineligibilityReason?: string; // Reason why the user is ineligible (if applicable)
}

interface MenuOrderItem extends Omit<Product, 'optionCategories'> { // Use Omit to prevent clash, add specific fields
    quantity: number;
    // Store selections based on category ID
    selectedOptions: { [categoryId: string]: string | string[] }; // Stores OPTION IDs
    itemTotalPrice: number; // Price including selected option modifiers
    // Add reward-related fields
    isRewardItem?: boolean; // Whether this item was added as part of a reward
    rewardId?: string; // The ID of the reward that added this item
}

interface CardSelectionState {
    [productId: string]: {
        quantity: number;
        // Store selected OPTION IDs based on category ID
        selectedOptions: { [categoryId: string]: string | string[] }; // e.g., { 'catId1': 'optionId3', 'catId4': ['optionId11', 'optionId12'] }
    };
}

interface RequiredOptionErrors {
    [productId: string]: string[];
}

interface MenuPageProps {
  placeNewOrder: (orderData: NewOrderData) => void;
  user: User | null; // Add user prop
}

// Define a development flag without using process.env
// const isDevelopment = window.location.hostname === 'localhost' || 
//                      window.location.hostname === '127.0.0.1';

// --- Component --- 
const Menu: React.FC<MenuPageProps> = ({ placeNewOrder, user }): React.ReactNode => {
  // --- State --- 
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<OptionCategory[]>([]);
  const [orderItems, setOrderItems] = useState<MenuOrderItem[]>([]);
  const [cardSelections, setCardSelections] = useState<CardSelectionState>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [productOptionsCache, setProductOptionsCache] = useState<Record<string, OptionCategory[]>>({});
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [requiredOptionErrors, setRequiredOptionErrors] = useState<RequiredOptionErrors>({});
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [availableRewards, setAvailableRewards] = useState<AvailableReward[]>([]);
  const [selectedRewards, setSelectedRewards] = useState<AvailableReward[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [rewardsError, setRewardsError] = useState<string | null>(null);

  // Make sure this is set correctly - add debugging console log
  const isLoggedIn = !!user;
  const isCustomer = user?.role === 'customer';
  
  console.log('[Menu Component] User:', user);
  console.log('[Menu Component] isLoggedIn:', isLoggedIn);
  console.log('[Menu Component] isCustomer:', isCustomer);
  console.log('[Menu Component] user role:', user?.role);

  // --- Helper Functions --- 
  const handleClearOptionsCache = () => {
    setProductOptionsCache({});
  };

  // --- Effects --- 
  useEffect(() => {
    if (user?.name) {
      setCustomerName(user.name);
    }
  }, [user]);

  useEffect(() => {
    // Fetch initial data for products and categories
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        // Split the calls to handle errors individually
        try {
          await fetchProductsAndTheirOptions();
        } catch (err) {
          console.error("Error fetching products:", err);
          setError("Failed to load menu products.");
        }
        
        try {
          await fetchCategories();
        } catch (err) {
          console.error("Error fetching categories:", err);
          // Don't set the error here, as we can still show products without categories
        }
        
        // Only fetch rewards for customers to avoid 500 errors
        if (isCustomer && user) {
          try {
            await fetchCustomerRewards();
          } catch (err) {
            console.error("Error fetching rewards:", err);
            // Don't set the main error for rewards issues
          }
        }
      } catch (err: any) {
        // This is a fallback for any uncaught errors
        setError(err.message || "Failed to load menu data.");
        console.error("Initial data fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, [user?.internalId, isCustomer]); // Re-fetch if user changes

  const fetchProductOptions = useCallback(async (productId: string): Promise<OptionCategory[]> => {
    if (productOptionsCache[productId]) {
      return productOptionsCache[productId];
    }
    try {
      const response = await fetch(`http://localhost:3001/api/products/${productId}/options`);
      if (!response.ok) {
        console.warn(`No options found or error for product ${productId}, status: ${response.status}`);
        return []; // Return empty array if no options or error
      }
      const optionsData: OptionCategory[] = await response.json();
      setProductOptionsCache(prevCache => ({ ...prevCache, [productId]: optionsData }));
      return optionsData;
    } catch (err) {
      console.error(`Error fetching options for product ${productId}:`, err);
      return []; // Return empty array on error
    }
  }, [productOptionsCache]);

  // Fetch all products and then their options
  const fetchProductsAndTheirOptions = async () => {
    try {
      const productsResponse = await fetch('http://localhost:3001/api/products');
      if (!productsResponse.ok) throw new Error('Failed to fetch products');
      let fetchedProducts = await productsResponse.json();

      // Map API response fields to match the Product interface
      fetchedProducts = fetchedProducts.map((product: any) => ({
        id: product.product_id,
        name: product.name,
        price: parseFloat(product.base_price), // Convert string to number
        description: product.description,
        image: product.image_url,
        category: product.category_id?.toString() || '',
        availability: product.availability || 'available',
        tags: product.tags || []
      }));

      // Filter out unavailable products if the user is a customer
      if (isCustomer) {
        fetchedProducts = fetchedProducts.filter((p: Product) => p.availability === 'available');
      }

      // Fetch options for each product and embed them
      const productsWithOptions = await Promise.all(
        fetchedProducts.map(async (product: Product) => {
          const options = await fetchProductOptions(product.id);
          return { ...product, optionCategories: options || [] }; // Ensure optionCategories is always an array
        })
      );
      setProducts(productsWithOptions);
      // Initialize card selections for newly fetched products if they aren't already set
      setCardSelections(prevSelections => {
        const newSelections = { ...prevSelections };
        productsWithOptions.forEach(p => {
          if (!newSelections[p.id]) {
            newSelections[p.id] = { quantity: 0, selectedOptions: {} };
          }
        });
        return newSelections;
      });

    } catch (err: any) {
      setError(err.message || "Failed to load products.");
      console.error("Product fetch error:", err);
      setProducts([]); // Set to empty array on error
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/categories');
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      
      // Map the backend category data to match our frontend model
      const mappedCategories = data.map((category: any) => ({
        id: String(category.category_id),
        name: category.name,
        image_url: category.image_url,
      }));
      
      setCategories(mappedCategories);
    } catch (err: any) {
      setError(err.message || "Failed to load categories.");
      setCategories([]);
    }
  };
  
  // --- Card State Management ---
  const getCardState = (productId: string, product: Product | undefined) => {
    const currentSelection = cardSelections[productId] || { quantity: 0, selectedOptions: {} };
    let initialSelectedOptions: { [categoryId: string]: string | string[] } = {};

    // Initialize selectedOptions based on product's optionCategories
    if (product && product.optionCategories) {
        product.optionCategories.forEach(category => {
            if (category.selectionType === 'radio' && category.options.length > 0) {
                // Pre-select the first option for radio groups if required, or if only one option
                // For now, let's not pre-select unless explicitly required by design
                // initialSelectedOptions[category.id] = category.options[0].id; 
            } else if (category.selectionType === 'checkbox') {
                initialSelectedOptions[category.id] = []; // Initialize as empty array for checkboxes
            }
        });
    }
    // Merge with any existing selections from cardSelections
    initialSelectedOptions = { ...initialSelectedOptions, ...currentSelection.selectedOptions };
    
    return {
        quantity: currentSelection.quantity,
        selectedOptions: initialSelectedOptions
    };
  };

  const updateCardState = (productId: string, updates: Partial<{ quantity: number; selectedOptions: { [categoryId: string]: string | string[] } }>) => {
    setCardSelections(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || { quantity: 0, selectedOptions: {} }), // Ensure prev[productId] exists
        ...updates,
        selectedOptions: {
          ...(prev[productId]?.selectedOptions || {}), // Ensure selectedOptions exists
          ...updates.selectedOptions,
        },
      },
    }));
     // Clear specific errors for this product when its state changes
     setRequiredOptionErrors(prevErrors => {
        const newErrors = { ...prevErrors };
        delete newErrors[productId];
        return newErrors;
    });
  };

  // --- Event Handlers ---
  const handleQuantityChange = (productId: string, newQuantity: number) => {
    if (newQuantity < 0) return; // Prevent negative quantities

    const product = products.find(p => p.id === productId);
    if (!product) return;

    // If quantity is reduced to 0, remove validation errors for this product
    if (newQuantity === 0) {
        setRequiredOptionErrors(prev => {
            const newState = { ...prev };
            delete newState[productId];
            return newState;
        });
    }
    updateCardState(productId, { quantity: newQuantity });
  };

  const handleOptionChange = (productId: string, categoryId: string, selectionType: 'radio' | 'checkbox', optionId: string) => { // Changed last param
    const currentProductCardState = getCardState(productId, products.find(p => p.id === productId));
    let newSelectionsForCategory: string | string[];

    if (selectionType === 'radio') {
      newSelectionsForCategory = optionId;
    } else { // Checkbox
      const currentCategorySelections = currentProductCardState.selectedOptions[categoryId];
      if (Array.isArray(currentCategorySelections)) {
        if (currentCategorySelections.includes(optionId)) {
          newSelectionsForCategory = currentCategorySelections.filter(id => id !== optionId);
        } else {
          newSelectionsForCategory = [...currentCategorySelections, optionId];
        }
      } else {
        newSelectionsForCategory = [optionId]; // Initialize if was not an array
      }
    }
    updateCardState(productId, {
      selectedOptions: { ...currentProductCardState.selectedOptions, [categoryId]: newSelectionsForCategory },
    });
  };

  const calculateItemTotalPrice = (
    basePrice: number, // Changed from product: Product
    quantity: number, 
    selectedOptions: { [categoryId: string]: string | string[] },
    optionCategories: OptionCategory[] // Added explicit parameter
  ): number => {
    let itemPrice = basePrice;
    if (optionCategories && selectedOptions) {
      optionCategories.forEach(category => {
        const selectionsForCategory = selectedOptions[category.id];
        if (selectionsForCategory) {
          const idsToConsider = Array.isArray(selectionsForCategory) ? selectionsForCategory : [selectionsForCategory];
          idsToConsider.forEach(selectedOptionId => {
            const optionDetail = category.options.find(opt => opt.id === selectedOptionId);
            if (optionDetail && optionDetail.priceModifier) {
              itemPrice += optionDetail.priceModifier;
            }
          });
        }
      });
    }
    return itemPrice * quantity;
  };

  const handleAddToCart = async (product: Product) => {
    const { quantity, selectedOptions } = getCardState(product.id, product);
    if (quantity === 0) {
      toast.error("Please set a quantity greater than zero.");
      return;
    }

    // Fetch/ensure options are loaded for validation
    const productWithOptions = product.optionCategories?.length 
        ? product 
        : { ...product, optionCategories: await fetchProductOptions(product.id) };

    // --- Validation for Required Options ---
    const errorsForProduct: string[] = [];
    if (productWithOptions.optionCategories) {
        productWithOptions.optionCategories.forEach(category => {
            if (category.is_required) {
                const selectionForCategory = selectedOptions[category.id];
                const isEmptySelection = !selectionForCategory || (Array.isArray(selectionForCategory) && selectionForCategory.length === 0);
                if (isEmptySelection) {
                    errorsForProduct.push(category.name); // Store category name for error message
                }
            }
        });
    }

    if (errorsForProduct.length > 0) {
        setRequiredOptionErrors(prev => ({ ...prev, [product.id]: errorsForProduct }));
        toast.error(`Please select options for: ${errorsForProduct.join(', ')}.`);
        return; // Stop if there are errors
    }
    // --- End Validation ---

    const itemPrice = calculateItemTotalPrice(product.price, quantity, selectedOptions, productWithOptions.optionCategories || []);

    const newItem: MenuOrderItem = {
      ...product,
      id: product.id,
      quantity,
      selectedOptions,
      itemTotalPrice: itemPrice / quantity, // Price per single item with options
    };

    setOrderItems(prevOrder => [...prevOrder, newItem]);
    // Reset card state for this product after adding to cart
    updateCardState(product.id, { quantity: 0, selectedOptions: {} });
    toast.success(`${product.name} added to order!`);
  };

  const handleRemoveFromOrder = (indexToRemove: number) => {
    setOrderItems(prevOrder => prevOrder.filter((_, index) => index !== indexToRemove));
  };

   const clearFullOrderDetails = () => {
        setOrderItems([]);
        setSelectedRewards([]);
        setDiscountAmount(0);
    };

   const handleClearOrder = () => {
        clearFullOrderDetails();
        toast.info("Order cleared.");
    };

   const fetchCustomerRewards = async () => {
    console.log('[fetchCustomerRewards] Starting fetch...');
    console.log('[fetchCustomerRewards] isCustomer:', isCustomer);
    
    // Don't attempt to fetch rewards if user is not a customer or not logged in
    if (!isCustomer || !user) {
        console.log('[fetchCustomerRewards] Skipping fetch for non-customer users or non-logged in users');
        return;
    }
    
    setRewardsLoading(true);
    setRewardsError(null);
    
    try {
        const token = localStorage.getItem('authToken');
        
        // Fetch both available rewards and claimed rewards separately
        let availableRewardsData: AvailableReward[] = [];
        let claimedRewardsData: AvailableReward[] = [];
        
        // 1. Fetch available rewards
        try {
            console.log('[fetchCustomerRewards] Fetching available rewards...');
            const availableResponse = await fetch(`http://localhost:3001/api/rewards/available`, {
            headers: {
                ...(token && { 'Authorization': `Bearer ${token}` }),
            },
        });
            
            if (availableResponse.ok) {
                availableRewardsData = await availableResponse.json();
                console.log('[fetchCustomerRewards] Available rewards data:', availableRewardsData);
            } else {
                const errorText = await availableResponse.text();
                console.error('[fetchCustomerRewards] Error fetching available rewards:', errorText);
            }
        } catch (error) {
            console.error('[fetchCustomerRewards] Exception fetching available rewards:', error);
        }
        
        // 2. Fetch claimed rewards
        if (user?.internalId) {
            try {
                console.log('[fetchCustomerRewards] Fetching claimed rewards for user:', user.internalId);
                const claimedResponse = await fetch(`http://localhost:3001/api/rewards/customer/${user.internalId}/claimed`, {
                    headers: {
                        ...(token && { 'Authorization': `Bearer ${token}` }),
                    },
                });
                
                if (claimedResponse.ok) {
                    claimedRewardsData = await claimedResponse.json();
                    console.log('[fetchCustomerRewards] Claimed rewards:', claimedRewardsData);
                } else {
                    const errorText = await claimedResponse.text();
                    console.error('[fetchCustomerRewards] Error fetching claimed rewards:', errorText);
                }
            } catch (error) {
                console.error('[fetchCustomerRewards] Exception fetching claimed rewards:', error);
            }
        }
        
        // 3. Combine rewards - use claimed rewards first, then available rewards not already claimed
        const combinedRewards = [
            ...claimedRewardsData.map(reward => ({
                ...reward,
                isClaimed: true,
                freeMenuItemIds: reward.freeMenuItemIds || [], // Ensure freeMenuItemIds is always an array
                isNewlyRedeemed: localStorage.getItem(`newly_redeemed_${reward.id}_${user?.internalId}`) === 'true'
            })),
            ...availableRewardsData.filter(reward => 
                !claimedRewardsData.some(claimed => 
                    claimed.id === reward.id && (reward.isVoucher ? claimed.instanceId === reward.instanceId : true)
                )
            ).map(reward => ({
                ...reward,
                freeMenuItemIds: reward.freeMenuItemIds || [] // Ensure freeMenuItemIds is always an array
            }))
        ];
        
        console.log('[fetchCustomerRewards] Combined rewards:', combinedRewards);
        setAvailableRewards(combinedRewards);
        
        // Check for newly redeemed rewards
        const newlyRedeemedRewards = combinedRewards.filter(r => r.isNewlyRedeemed);
        if (newlyRedeemedRewards.length > 0) {
            setShowRewardsModal(true);
            newlyRedeemedRewards.forEach(reward => {
                localStorage.removeItem(`newly_redeemed_${reward.id}_${user?.internalId}`);
            });
            
            toast.success(
                newlyRedeemedRewards.length === 1 
                ? `New reward available: ${newlyRedeemedRewards[0].name}!` 
                : `${newlyRedeemedRewards.length} new rewards available!`
            );
        }
    } catch (err: any) {
        console.error("[fetchCustomerRewards] Error:", err);
        setRewardsError(err.message || "Could not load your rewards.");
    } finally {
    setRewardsLoading(false);
        console.log('[fetchCustomerRewards] Completed fetch');
    }
   };

   const applyReward = (reward: AvailableReward) => {
    // Skip if reward is not eligible and not claimed
    if (reward.isEligible === false && !reward.isClaimed) {
        toast.error(`Cannot redeem: ${reward.ineligibilityReason || 'Not eligible'}`);
        return;
    }
    
    // Check if we're removing or adding the reward
    const isRemoving = selectedRewards.find(r => r.id === reward.id && r.instanceId === reward.instanceId);
    
    // Update the selected rewards list
    setSelectedRewards(prev => 
        isRemoving
            ? prev.filter(r => !(r.id === reward.id && r.instanceId === reward.instanceId)) 
            : [...prev, reward]
    );
    
    // Show appropriate toast notification
    if (isRemoving) {
        toast.info(`Removed: ${reward.name}`);
    } else {
        if (reward.discountPercentage) {
            toast.success(`Applied: ${reward.discountPercentage}% discount`);
        } else if (reward.discountFixedAmount) {
            toast.success(`Applied: $${reward.discountFixedAmount.toFixed(2)} off your order`);
        } else if (reward.freeMenuItemIds && reward.freeMenuItemIds.length > 0) {
            const itemNames = reward.freeMenuItemIds
                .map(id => products.find(p => p.id === id)?.name || 'item')
                .join(', ');
            toast.success(`Applied: Free ${itemNames}`);
        } else {
            toast.success(`Applied: ${reward.name}`);
        }
    }
    
    // Calculate the new discount amount based on the updated rewards list
    recalculateDiscount( 
        isRemoving
            ? selectedRewards.filter(r => !(r.id === reward.id && r.instanceId === reward.instanceId))
            : [...selectedRewards, reward]
    );
    
    // Handle free items immediately (will be called again in useEffect)
    if (!isRemoving && reward.freeMenuItemIds && reward.freeMenuItemIds.length > 0) {
        // First remove any existing items for this specific reward
        const nonRewardOrderItems = orderItems.filter(item => 
            !(item.isRewardItem && item.rewardId === reward.id)
        );
        
        // Then add the free items for this reward
        let newOrderItems = [...nonRewardOrderItems];
        reward.freeMenuItemIds.forEach(productId => {
            const productDetails = products.find(p => p.id === productId);
            if (productDetails) {
                newOrderItems.push({
                    ...productDetails,
                    id: productDetails.id,
                    quantity: 1,
                    selectedOptions: {},
                    itemTotalPrice: 0,
                    isRewardItem: true,
                    rewardId: reward.id, // Always use reward.id for database consistency
                });
            }
        });
        setOrderItems(newOrderItems);
    }
   };

   const recalculateDiscount = (rewards = selectedRewards) => {
    let currentTotalDiscount = 0;
    // Calculate total excluding any free items from rewards
    const currentOrderTotal = orderItems
      .filter(item => !item.isRewardItem)
      .reduce((sum, item) => sum + (item.itemTotalPrice * item.quantity), 0);
    
    // Calculate discounts
    rewards.forEach(reward => {
        if (reward.discountPercentage && reward.discountPercentage > 0) {
            currentTotalDiscount += currentOrderTotal * (reward.discountPercentage / 100);
        } else if (reward.discountFixedAmount && reward.discountFixedAmount > 0) {
            currentTotalDiscount += reward.discountFixedAmount;
        }
    });
    
    // Cap discount at order total
    setDiscountAmount(Math.min(currentTotalDiscount, currentOrderTotal));
   };

   const addFreeItemsToCart = () => {
    // Logic to add free items to cart based on selected rewards
    // First, remove any existing reward items to avoid duplicates if rewards are toggled
    const nonRewardOrderItems = orderItems.filter(item => !item.isRewardItem);
    let newOrderItems = [...nonRewardOrderItems];

    selectedRewards.forEach(reward => {
        if (reward.freeMenuItemIds && reward.freeMenuItemIds.length > 0) {
            reward.freeMenuItemIds.forEach(productId => {
                const productDetails = products.find(p => p.id === productId);
                if (productDetails) {
                    // Check if this free item (from this specific reward instance) is already in cart
                    const existingFreeItemIndex = newOrderItems.findIndex(
                        item => item.id === productId && item.isRewardItem && item.rewardId === reward.id
                    );

                    if (existingFreeItemIndex === -1) { // Only add if not already present for this reward
                        newOrderItems.push({
                            ...productDetails,
                            id: productDetails.id,
                            quantity: 1, // Default to 1 for free items
                            selectedOptions: {}, // Free items usually don't have selectable options or have pre-defined ones
                            itemTotalPrice: 0, // Free items have zero price
                            isRewardItem: true,
                            rewardId: reward.id, // Always use reward.id for database consistency
                        });
                    }
                }
            });
        }
    });
    setOrderItems(newOrderItems);
   };

   useEffect(() => {
    addFreeItemsToCart();
    recalculateDiscount(); // Recalculate discount whenever selectedRewards or orderItems change
   }, [selectedRewards, products]); // Rerun when selected rewards or products list (for finding item details) changes

   // --- Checkout Logic ---
   const handleCheckout = async () => {
    if (orderItems.length === 0) {
      toast.error("Your order is empty!");
      return;
    }
    if (!isLoggedIn && !customerName.trim()) {
        toast.error("Please enter a name for the order.");
        setCheckoutError("Customer name is required for guest orders.");
        return;
    }
    setCheckoutError(null);
    setIsSubmittingOrder(true);

    // --- Validate Selected Rewards ---
    const ineligibleRewards = selectedRewards.filter(reward => 
        reward.isEligible === false && !reward.isClaimed
    );
    
    if (ineligibleRewards.length > 0) {
        const rewardNames = ineligibleRewards.map(r => r.name).join(', ');
        toast.error(`Cannot checkout with ineligible rewards: ${rewardNames}`);
        setCheckoutError(`Please remove ineligible rewards before checkout: ${rewardNames}`);
        setIsSubmittingOrder(false);
        return;
    }
    // --- End Reward Validation ---

    // --- Validation for Required Options for all items in cart ---
    let allItemsValid = true;
    const cartOptionErrors: RequiredOptionErrors = {};

    for (const item of orderItems) {
        // Skip validation for items that are part of a reward redemption
        if (item.isRewardItem) continue; 

        const productDetails = products.find(p => p.id === item.id);
        if (!productDetails) continue; // Should not happen if item is in products list

        const productWithOptions = productDetails.optionCategories?.length 
            ? productDetails 
            : { ...productDetails, optionCategories: await fetchProductOptions(item.id) };
        
        const errorsForCurrentItem: string[] = [];
        if (productWithOptions.optionCategories) {
            productWithOptions.optionCategories.forEach((category:any) => { // Added any type for category
                if (category.is_required) {
                    const selectionForCategory = item.selectedOptions[category.id];
                    const isEmptySelection = !selectionForCategory || (Array.isArray(selectionForCategory) && selectionForCategory.length === 0);
                    if (isEmptySelection) {
                        errorsForCurrentItem.push(category.name);
                    }
                }
            });
        }
        if (errorsForCurrentItem.length > 0) {
            allItemsValid = false;
            cartOptionErrors[item.id] = errorsForCurrentItem;
        }
    }

    if (!allItemsValid) {
        setRequiredOptionErrors(prev => ({ ...prev, ...cartOptionErrors }));
        // Construct a general error message for toast
        const errorMessages = Object.entries(cartOptionErrors).map(([productId, errors]) => {
            const productName = products.find(p => p.id === productId)?.name || 'Unknown Product';
            return `${productName}: ${errors.join(', ')}`;
        });
        toast.error(`Please select required options for: ${errorMessages.join('; ')}.`);
        setShowCheckoutModal(false); // Close modal to show errors on cards
        setIsSubmittingOrder(false);
        return;
    }
    // --- End Validation ---

    const orderDataItems: PlacedOrderItemDetail[] = orderItems.map(item => {
      // Map selectedOptions (which are option IDs) to their labels for the snapshot
      const selectedOptionsSnapshot: { group: string, option: string }[] = [];
      const productDef = products.find(p => p.id === item.id);

      if (productDef && productDef.optionCategories && item.selectedOptions) {
          productDef.optionCategories.forEach(cat => {
              const selection = item.selectedOptions[cat.id];
              if (selection) {
                  const selectedIds = Array.isArray(selection) ? selection : [selection];
                  selectedIds.forEach(optId => {
                      const optionDetail = cat.options.find(o => o.id === optId);
                      if (optionDetail) {
                          selectedOptionsSnapshot.push({ group: cat.name, option: optionDetail.label });
                      }
                  });
              }
          });
      }
      
      return {
          productId: item.id,
          name: item.name, // Product name snapshot
          quantity: item.quantity,
          unitPriceSnapshot: item.itemTotalPrice, // Price per item including options
          selectedOptionsSnapshot: selectedOptionsSnapshot, // Array of { groupName, optionLabel }
          selectedOptionIds: item.selectedOptions, // Keep the raw selected option IDs
          // Pass reward info if item is part of a reward
          isRewardItem: item.isRewardItem,
          rewardId: item.rewardId 
      };
    });

    const orderDataRedeemedRewards: RedeemedReward[] = selectedRewards
      .map(r => {
        // Filter out any undefined or empty items
        const freeItemsArray = Array.isArray(r.freeMenuItemIds) ? r.freeMenuItemIds.filter(id => id !== undefined && id !== null && id !== '') : [];
        
        // Ensure we have a valid rewardId - if not, skip this reward
        if (!r.id) {
          console.error("Skipping reward with missing ID:", r);
          return null;
        }
        
        // Calculate the subtotal from items that aren't free items
        const nonRewardItemsSubtotal = orderItems
          .filter(item => !item.isRewardItem)
          .reduce((sum, item) => sum + (item.itemTotalPrice * item.quantity), 0);
        
        // Create reward payload with all possible properties from the reward definition
        return {
          rewardId: r.id,
          rewardType: r.type || 'standard',
          voucherId: r.isVoucher && r.instanceId ? r.instanceId : undefined,
          // Handle discount properties if present
          appliedDiscount: r.discountPercentage && r.discountPercentage > 0 ? 
            { 
              type: 'percentage', 
              value: r.discountPercentage, 
              originalTotal: nonRewardItemsSubtotal, 
              discountedTotal: nonRewardItemsSubtotal * (1 - r.discountPercentage / 100) 
            } : 
            r.discountFixedAmount && r.discountFixedAmount > 0 ? 
            { 
              type: 'fixed', 
              value: r.discountFixedAmount, 
              originalTotal: nonRewardItemsSubtotal, 
              discountedTotal: nonRewardItemsSubtotal - r.discountFixedAmount 
            } : 
            undefined,
          // Include free items info if present
          freeItems: freeItemsArray.length > 0 ? freeItemsArray : undefined
        } as RedeemedReward;
      })
      .filter((reward): reward is RedeemedReward => reward !== null);

    const orderData: NewOrderData = {
      customerName: customerName.trim(),
      items: orderDataItems,
      redeemedRewards: orderDataRedeemedRewards,
      userId: user?.internalId,
    };

    try {
      await placeNewOrder(orderData);
      toast.success("Order placed successfully!");
      setShowCheckoutModal(false);
      
      // Clear cart and selections
      clearFullOrderDetails();
      setSelectedRewards([]);
      setDiscountAmount(0);
      setCustomerName(user?.name || ''); // Reset customer name
      
      // If the user is a customer, fetch their rewards again with a slight delay
      // to ensure backend processing is complete
      if (isCustomer) {
        setTimeout(() => {
          fetchCustomerRewards();
        }, 1000);
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast.error(`Checkout failed: ${err.message || 'Please try again.'}`);
      setCheckoutError(err.message || "An unexpected error occurred.");
    }
    setIsSubmittingOrder(false);
  };

    // --- Filtering and Utility --- 
    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const nameMatch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
            const categoryMatch = selectedCategory ? product.category === selectedCategory : true;
            // For customers, only show available products. For others (staff), show all but visually distinguish.
            const availabilityMatch = isCustomer ? product.availability === 'available' : true;
            return nameMatch && categoryMatch && availabilityMatch;
        });
    }, [products, searchTerm, selectedCategory, isCustomer]);

  // --- Derived State ---
  const getOptionLabelsFromIds = (productId: string, selectedOptionsValues: { [categoryId: string]: string | string[] }): string[] => {
    const productDetails = products.find(p => p.id === productId);
    if (!productDetails || !productDetails.optionCategories) return [];

    const labels: string[] = [];
    productDetails.optionCategories.forEach(category => {
        const selection = selectedOptionsValues[category.id];
        if (selection) {
            const ids = Array.isArray(selection) ? selection : [selection];
            ids.forEach(optionId => {
                const option = category.options.find(opt => opt.id === optionId);
                if (option) labels.push(option.label);
            });
        }
    });
    return labels;
  };

  // Add this function before the Rewards Modal
  const renderRewardsList = (rewards: AvailableReward[]) => {
    // For non-customers, show a message instead of an empty rewards list
    if (!isCustomer) {
        return (
            <div className="p-5 text-center">
                <p className="text-gray-500 font-medium">
                    Rewards are only available to customer accounts.
                </p>
            </div>
        );
    }
    
    // Show a message if loading
    if (rewardsLoading) {
        return (
            <div className="p-5 text-center">
                <div className="animate-pulse flex justify-center mb-2">
                    <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                </div>
                <p className="text-gray-500">Loading available rewards...</p>
            </div>
        );
    }
    
    // Show a message if there was an error loading rewards
    if (rewardsError) {
        return (
            <div className="p-5 text-center">
                <p className="text-red-500 mb-2">Unable to load rewards</p>
                <p className="text-gray-500 text-sm">{rewardsError}</p>
            </div>
        );
    }
    
    // Show a message if no rewards are available
    if (rewards.length === 0) {
        return (
            <div className="p-5 text-center">
                <p className="text-gray-500">You don't have any rewards available.</p>
            </div>
        );
    }
    
    // If we have rewards, show them
    return rewards.map(reward => {
        // Check if reward is expired based on expiryDate
        const isExpired = reward.expiryDate && new Date(reward.expiryDate) < new Date();
        
        // Check if reward is selectable (eligible or claimed)
        const isSelectable = (reward.isEligible !== false || reward.isClaimed) && !isExpired;
        
        // Get status text and color for the badge
        let statusBadge = null;
        if (reward.isVoucher) {
            statusBadge = <span className="text-xs text-sky-600 bg-sky-100 px-1.5 py-0.5 rounded-full">Voucher</span>;
        }
        if (reward.isClaimed && !reward.isVoucher) {
            statusBadge = <span className="text-xs text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-full">Claimed</span>;
        }
        if (reward.isNewlyRedeemed) {
            statusBadge = <span className="text-xs text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded-full">New!</span>;
        }
        if (!isSelectable && !isExpired) {
            statusBadge = <span className="text-xs text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">Not Eligible</span>;
        }
        if (isExpired) {
            statusBadge = <span className="text-xs text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">Expired</span>;
        }
        
        return (
            <div 
                key={reward.isVoucher ? reward.instanceId : reward.id} 
                className={`p-4 border rounded-lg transition-all duration-150 
                    ${selectedRewards.find(r => r.id === reward.id && r.instanceId === reward.instanceId) 
                      ? 'bg-emerald-50 border-emerald-400 shadow-md' 
                      : 'bg-white border-stone-200 hover:border-stone-300'}
                    ${!isSelectable ? 'opacity-70' : 'hover:shadow-md'}
                    ${reward.isNewlyRedeemed ? 'animate-pulse border-yellow-400 shadow-md' : ''}
                    relative
                `}
                onClick={() => isSelectable && applyReward(reward)}
                title={!isSelectable 
                    ? (isExpired 
                        ? `This voucher has expired` 
                        : reward.ineligibilityReason || 'Not eligible') 
                    : reward.description}
                tabIndex={isSelectable ? 0 : -1} // Only make focusable if selectable
                role="button"
                aria-pressed={!!selectedRewards.find(r => r.id === reward.id && r.instanceId === reward.instanceId)}
                aria-disabled={!isSelectable}
            >
                {!isSelectable && (
                    <div className="absolute inset-0 bg-gray-100 bg-opacity-40 flex items-center justify-center z-10 rounded-lg">
                        <div className="bg-white p-2 rounded-lg shadow-md text-center">
                            {isExpired ? (
                                <p className="text-red-600 font-medium">Expired</p>
                            ) : (
                                <p className="text-orange-600 font-medium">Not Eligible</p>
                            )}
                        </div>
                    </div>
                )}
                
                <div className="flex items-start gap-3 relative z-0">
                    <div className="w-20 h-20 rounded-md bg-stone-100 flex-shrink-0 overflow-hidden">
                        {reward.image ? (
                            <img 
                                src={reward.image} 
                                alt="" 
                                className="w-full h-full object-contain" 
                                onError={(e) => {
                                    // Fallback for image loading errors
                                    (e.target as HTMLImageElement).onerror = null;
                                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x200?text=Reward';
                                }}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a4 4 0 00-4-4H8.8a4 4 0 00-3.2 1.6" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v5.4a4 4 0 001.6 3.2L12 16m0 0l5.4-4.4a4 4 0 001.6-3.2V6a4 4 0 00-4-4h-.8a4 4 0 00-3.2 1.6" />
                                </svg>
                            </div>
                        )}
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-center">
                            <h4 className="font-semibold text-gray-800 text-base">
                                {reward.name} 
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {statusBadge}
                                </div>
                            </h4>
                            {selectedRewards.find(r => r.id === reward.id && r.instanceId === reward.instanceId) && (
                                <div className="bg-emerald-100 p-1 rounded-full">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            )}
                        </div>
                        <p className="text-sm text-gray-600 mt-2">{reward.description || 'No description available'}</p>
                        {(reward.discountPercentage || reward.discountFixedAmount || (reward.freeMenuItemIds && reward.freeMenuItemIds.length > 0)) && (
                            <div className="mt-2 pt-2 border-t border-stone-200 text-sm font-medium">
                                {reward.discountPercentage && <div className="text-emerald-700">{reward.discountPercentage}% off your order</div>}
                                {reward.discountFixedAmount && <div className="text-emerald-700">${reward.discountFixedAmount.toFixed(2)} off your order</div>}
                                {reward.freeMenuItemIds && reward.freeMenuItemIds.length > 0 && 
                                    <div className="text-emerald-700">
                                        Free item{reward.freeMenuItemIds.length > 1 ? 's' : ''}: {reward.freeMenuItemIds.map(id => products.find(p=>p.id === id)?.name || 'Item').join(', ')}
                                    </div>
                                }
                            </div>
                        )}
                        {reward.isVoucher && reward.expiryDate && (
                            <p className={`text-sm mt-2 ${new Date(reward.expiryDate) < new Date() ? 'text-red-500 font-medium' : 'text-stone-500'}`}>
                                {new Date(reward.expiryDate) < new Date() 
                                    ? `Expired on: ${new Date(reward.expiryDate).toLocaleDateString()}` 
                                    : `Valid until: ${new Date(reward.expiryDate).toLocaleDateString()}`}
                            </p>
                        )}
                        {!isSelectable && !isExpired && reward.ineligibilityReason && (
                            <p className="text-sm mt-2 text-orange-600 font-medium">
                                {reward.ineligibilityReason}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    });
  };

  // --- Render --- 
  if (isLoading && products.length === 0) return <div className="p-6">Loading menu...</div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  // Calculate total price of items in the order
  const currentOrderSubtotal = orderItems.reduce((sum, item) => sum + (item.itemTotalPrice * item.quantity), 0);
  const orderTotalAfterDiscount = Math.max(0, currentOrderSubtotal - discountAmount);

  console.log('[Menu Component] products:', products);
  console.log('[Menu Component] filteredProducts:', filteredProducts);
  console.log('[Menu Component] isLoading:', isLoading);
  console.log('[Menu Component] error:', error);
  console.log('[Menu Component] categories:', categories);
  console.log('[Menu Component] selectedCategory:', selectedCategory);

  return (
    <div className="flex h-full bg-stone-50">
      {/* Main Menu Area */} 
      <div className="flex-1 p-6 flex flex-col overflow-y-hidden">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Our Menu</h1>
        <p className="text-gray-600 mb-6">Select items to build your order.</p>
        
        {/* Filters */} 
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <input 
            type="text"
            placeholder="Search menu items..."
            className="flex-grow p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select 
            className="p-3 border border-stone-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow appearance-none"
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>

        {/* Product Grid - Now takes remaining height and scrolls */} 
        {isLoading && <div className="flex-1 flex items-center justify-center">
          <div className="p-8 text-center">
            <div className="animate-pulse flex flex-col items-center">
              <div className="h-12 w-12 bg-emerald-200 rounded-full mb-4"></div>
              <div className="h-4 bg-stone-200 rounded w-48 mb-2.5"></div>
              <div className="h-3 bg-stone-200 rounded w-32"></div>
            </div>
            <p className="text-gray-500 mt-4">Loading menu...</p>
          </div>
        </div>}

        {!isLoading && products.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <h3 className="mt-2 text-xl font-medium text-gray-900">No products available</h3>
              <p className="mt-1 text-gray-500">The menu is currently empty. Please check back later.</p>
            </div>
          </div>
        )}

        {!isLoading && products.length > 0 && filteredProducts.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center py-10">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="mt-2 text-xl font-medium text-gray-900">No results found</h3>
              <p className="mt-1 text-gray-500">No products match your search or filter criteria.</p>
              <button 
                className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory(null);
                }}
              >
                Clear filters
              </button>
            </div>
            </div>
        )}

        {!isLoading && products.length > 0 && filteredProducts.length > 0 && (
        <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 scrollbar-thin scrollbar-thumb-stone-300 scrollbar-track-stone-100">
          {filteredProducts.map(product => {
            const cardState = getCardState(product.id, product);
            const totalPriceForItemOnCard = calculateItemTotalPrice(product.price, cardState.quantity, cardState.selectedOptions, product.optionCategories || []);
            const productHasRequiredErrors = requiredOptionErrors[product.id] && requiredOptionErrors[product.id].length > 0;
            const isUnavailable = product.availability === 'unavailable';
            const cardBorderColor = productHasRequiredErrors ? 'border-red-400 shadow-red-100' : (isUnavailable && !isCustomer ? 'border-orange-300' : 'border-stone-200');
            const cardOpacity = isUnavailable && isCustomer ? 'opacity-50 cursor-not-allowed' : '';

            return (
              <div 
                key={product.id} 
                className={`bg-white rounded-xl shadow-lg overflow-hidden border-2 ${cardBorderColor} transition-all duration-150 flex flex-col ${cardOpacity} h-[550px]`}
              >
                  <div className="relative h-48 flex-shrink-0 bg-stone-100">
                    {product.image ? (
                      <img 
                        src={product.image} 
                        alt={product.name} 
                        className="w-full h-full object-contain" 
                        onError={(e) => {
                          // Fallback for image loading errors
                          (e.target as HTMLImageElement).onerror = null;
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x200?text=No+Image';
                        }}
                      />
                    ) : (
                        <div className="w-full h-full bg-stone-200 flex items-center justify-center text-stone-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        </div>
                    )}
                    {isUnavailable && (
                        <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-semibold 
                            ${isCustomer ? 'bg-red-500 text-white' : 'bg-orange-100 text-orange-700'}`}>
                            Unavailable
                        </div>
                    )}
                </div>
                
                <div className="p-4 flex flex-col flex-grow overflow-hidden">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2 hover:underline hover:cursor-pointer" title={product.name}>{product.name}</h3>
                  <div className="mb-3 h-16 overflow-y-auto scrollbar-thin scrollbar-thumb-stone-100 scrollbar-track-transparent pr-1">
                    <p className="text-xs text-gray-500" title={product.description || 'No description'}>{product.description || 'No description'}</p>
                  </div>
                  <p className="text-xl font-bold text-emerald-600 mb-3">${product.price.toFixed(2)}</p>

                  {/* Options Section - Scrollable if many options */} 
                  {(product.optionCategories && product.optionCategories.length > 0) && (
                    <div className="mb-3 max-h-60 min-h-[120px] overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-stone-200 scrollbar-track-white">
                      {product.optionCategories.map(category => (
                        <MenuOptionSelector
                          key={category.id}
                          productId={product.id} // Pass productId
                          title={category.name}
                          options={category.options}
                          selectedValue={cardState.selectedOptions[category.id] || (category.selectionType === 'checkbox' ? [] : '')} // Pass selected option ID(s)
                          onChange={(optionId) => handleOptionChange(product.id, category.id, category.selectionType, optionId)} // Pass optionId
                          type={category.selectionType}
                          isRequired={category.is_required}
                          isErrored={requiredOptionErrors[product.id]?.includes(category.name)}
                        />
                      ))}
                    </div>
                  )}
                  {productHasRequiredErrors && (
                        <p className="text-xs text-red-500 mb-2">Required: {requiredOptionErrors[product.id].join(', ')}</p>
                  )}
                  
                  <div className="mt-auto pt-3 border-t border-stone-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Quantity:</span>
                      <div className="flex items-center">
                        <button 
                          onClick={() => handleQuantityChange(product.id, cardState.quantity - 1)} 
                          className="px-2 py-0.5 bg-stone-200 text-stone-700 rounded-md hover:bg-stone-300 disabled:opacity-50"
                          disabled={isUnavailable || cardState.quantity <= 0}
                        >
                          -
                        </button>
                        <span className="px-3 font-medium w-10 text-center">{cardState.quantity}</span>
                        <button 
                          onClick={() => handleQuantityChange(product.id, cardState.quantity + 1)} 
                          className="px-2 py-0.5 bg-stone-200 text-stone-700 rounded-md hover:bg-stone-300 disabled:opacity-50"
                          disabled={isUnavailable}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleAddToCart(product)}
                      className={`w-full py-2 text-sm font-medium rounded-lg transition-colors 
                        ${isUnavailable ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 
                                         (cardState.quantity > 0 ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-stone-200 text-stone-600 hover:bg-stone-300')}
                      `}
                      disabled={isUnavailable || cardState.quantity === 0}
                    >
                      {cardState.quantity > 0 ? `Add to Order ($${totalPriceForItemOnCard.toFixed(2)})` : (isUnavailable ? 'Unavailable' : 'Select Quantity')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Order Summary Sidebar */} 
      <div className="w-96 bg-white p-6 shadow-lg flex flex-col border-l border-stone-200 overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-5">Your Order</h2>
        
        {/* Rewards Section - Always visible with enhanced styling */}
        <div className="mb-5 p-4 bg-yellow-50 rounded-lg border-2 border-yellow-300 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800 text-lg flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Rewards
            </h3>
            {selectedRewards.length > 0 && (
              <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full font-medium">{selectedRewards.length} Applied</span>
            )}
          </div>
          
          {isCustomer ? (
            <>
              {selectedRewards.length > 0 ? (
                <div className="mb-3 p-2 bg-emerald-50 rounded-lg border border-emerald-200 max-h-[20vh] overflow-y-auto">
                  <ul className="space-y-1.5">
                    {selectedRewards.map(reward => (
                      <li key={reward.isVoucher ? reward.instanceId : reward.id} className="flex items-center justify-between text-sm">
                        <span className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-emerald-500 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs text-gray-700 truncate" title={reward.name}>{reward.name}</span>
                        </span>
                        <button 
                          onClick={() => applyReward(reward)} 
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-gray-600 mb-3">You have {availableRewards.length} available rewards. Apply them to get discounts or free items!</p>
              )}
              
              <button 
                onClick={() => setShowRewardsModal(true)}
                className={`w-full py-2.5 px-4 text-sm font-medium rounded-lg transition-colors shadow-sm
                  ${selectedRewards.length > 0 
                    ? 'bg-stone-100 text-stone-800 hover:bg-stone-200' 
                    : 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500'}`}
                disabled={rewardsLoading}
              >
                {rewardsLoading 
                  ? 'Loading Rewards...' 
                  : (availableRewards.length > 0 
                    ? (selectedRewards.length > 0 ? 'Manage Applied Rewards' : 'Apply Rewards / Vouchers') 
                    : 'No Rewards Available')}
              </button>
              {rewardsError && <p className="text-xs text-red-500 mt-1 text-center">{rewardsError}</p>}
            </>
          ) : (
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-3">Log in as a customer to view and apply rewards!</p>
              <button 
                className="w-full py-2.5 px-4 text-sm bg-stone-100 text-stone-800 rounded-lg opacity-75 hover:opacity-100 hover:bg-stone-200 transition-colors"
                onClick={() => toast.info("Please log in as a customer to access rewards")}
              >
                Log in to Access Rewards
              </button>
            </div>
          )}
        </div>
        
        {/* Order Items List - Scrollable with fixed height */} 
        {orderItems.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-stone-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-gray-500">Your order is currently empty.</p>
            <p className="text-xs text-gray-400 mt-1">Add items from the menu to get started.</p>
          </div>
        ) : (
          <div className="max-h-[40vh] overflow-y-auto mb-4 pr-2 space-y-3 scrollbar-thin scrollbar-thumb-stone-200 scrollbar-track-white">
            {orderItems.map((item, index) => (
              <div key={index} className={`p-3 rounded-lg border ${item.isRewardItem ? 'bg-emerald-50 border-emerald-200' : 'bg-stone-50 border-stone-200'} `}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center">
                    <p className="font-semibold text-gray-800 text-sm">{item.quantity}x {item.name}</p>
                      {item.isRewardItem && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          <svg className="mr-1 h-3 w-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-5V9a1 1 0 10-2 0v1H4a2 2 0 110-4h1.17C5.06 5.687 5 5.35 5 5zm4 1V5a1 1 0 10-1 1h1zm3 0a1 1 0 10-1-1v1h1z" clipRule="evenodd"></path>
                            <path d="M9 11H3v5a2 2 0 002 2h4v-7zM11 18h4a2 2 0 002-2v-5h-6v7z"></path>
                          </svg>
                          Free
                        </span>
                      )}
                    </div>
                    {/* Display selected options */} 
                    {Object.values(item.selectedOptions).flat().length > 0 && (
                        <ul className="text-xs text-stone-500 mt-0.5 list-disc list-inside pl-1">
                            {getOptionLabelsFromIds(item.id, item.selectedOptions).map((label: string, i: number) => <li key={i}>{label}</li>)}
                        </ul>
                    )}
                  </div>
                  <div className="text-right flex flex-col items-end">
                    {item.isRewardItem ? (
                      <>
                        <p className="text-sm font-medium text-emerald-600 line-through">${(item.price * item.quantity).toFixed(2)}</p>
                        <p className="text-sm font-medium text-emerald-600">$0.00</p>
                      </>
                    ) : (
                      <p className="text-sm font-medium text-gray-800">${(item.itemTotalPrice * item.quantity).toFixed(2)}</p>
                    )}
                    <button onClick={() => handleRemoveFromOrder(index)} className="text-xs text-red-500 hover:text-red-700 mt-1">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
            </div>
        )}

        {/* Order Total & Checkout */} 
        <div className="mt-auto pt-4 border-t border-stone-200 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium text-gray-800">${currentOrderSubtotal.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
             <div className="flex justify-between text-sm text-emerald-600">
                <span className="">Discount Applied:</span>
                <span className="font-medium">-${discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-xl font-bold text-gray-800 pt-2 border-t border-stone-200">
            <span>Order Total:</span>
            <span>${orderTotalAfterDiscount.toFixed(2)}</span>
          </div>
          <button 
            onClick={() => orderItems.length > 0 ? setShowCheckoutModal(true) : toast.error("Please add items to your order first.")}
            className="w-full py-3 mt-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-md disabled:bg-stone-300"
            disabled={orderItems.length === 0 || isSubmittingOrder}
          >
            {isSubmittingOrder ? 'Processing...' : 'Proceed to Checkout'}
          </button>
          {orderItems.length > 0 && (
             <button 
                onClick={handleClearOrder}
                className="w-full py-2 mt-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
             >
                Clear Order
            </button>
          )}
        </div>
      </div>

      {/* Checkout Modal */} 
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl p-6 sm:p-8 shadow-2xl w-full max-w-md transform transition-all">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">Confirm Order</h3>
            {!isLoggedIn && (
                <div className="mb-5">
                    <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">Your Name (for the order):</label>
                    <input 
                        type="text"
                        id="customerName"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full p-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        placeholder="E.g., Guest User"
                    />
                </div>
            )}
            <div className="space-y-2 mb-6">
                <div className="max-h-40 overflow-y-auto pr-2 mb-3 scrollbar-thin scrollbar-thumb-stone-200 scrollbar-track-white">
                    {orderItems.map((item, index) => (
                        <div key={index} className="flex justify-between items-center py-1.5 border-b border-stone-100 text-sm">
                            <span className="flex items-center">
                                {item.quantity}x {item.name}
                                {item.isRewardItem && (
                                    <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                        Free
                                    </span>
                                )}
                            </span>
                            <span className={item.isRewardItem ? 'text-emerald-600' : ''}>
                                ${item.isRewardItem ? '0.00' : (item.itemTotalPrice * item.quantity).toFixed(2)}
                            </span>
                        </div>
                    ))}
                </div>
                {selectedRewards.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-2">
                        <p className="text-xs font-medium text-yellow-800 mb-1">Applied Rewards:</p>
                        <ul className="text-xs text-yellow-700 space-y-0.5">
                            {selectedRewards.map(reward => (
                                <li key={reward.isVoucher ? reward.instanceId : reward.id} className="flex justify-between">
                                    <span>{reward.name}</span>
                                    {(reward.discountPercentage || reward.discountFixedAmount) && (
                                        <span className="font-medium">
                                            {reward.discountPercentage ? `${reward.discountPercentage}%` : `$${reward.discountFixedAmount?.toFixed(2)}`} off
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                <div className="flex justify-between font-medium">
                    <span className="text-gray-600">Items:</span>
                    <span className="text-gray-800">{orderItems.reduce((sum, item) => sum + item.quantity, 0)}</span>
                </div>
                <div className="flex justify-between font-medium">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="text-gray-800">${currentOrderSubtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                        <span className="">Discount Applied:</span>
                        <span className="">-${discountAmount.toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between text-xl font-bold text-gray-800 pt-2 border-t border-stone-200">
                    <span>Order Total:</span>
                    <span>${orderTotalAfterDiscount.toFixed(2)}</span>
                </div>
            </div>
            {checkoutError && <p className="text-sm text-red-500 mb-4 text-center">{checkoutError}</p>}
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => setShowCheckoutModal(false)} 
                className="flex-1 py-3 px-4 bg-stone-100 text-stone-700 font-medium rounded-lg hover:bg-stone-200 transition-colors"
                disabled={isSubmittingOrder}
              >
                Back to Menu
              </button>
              <button 
                onClick={handleCheckout} 
                className="flex-1 py-3 px-4 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-stone-300"
                disabled={isSubmittingOrder}
              >
                {isSubmittingOrder ? 'Placing Order...' : 'Confirm & Place Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rewards Modal */} 
      {showRewardsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-yellow-50 p-5 border-b border-yellow-200">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold text-gray-800">Your Rewards & Vouchers</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full">
                    {selectedRewards.length} Applied
                  </span>
                  <button 
                    onClick={() => {
                      console.log('[Menu Component] Closing rewards modal');
                      setShowRewardsModal(false);
                    }}
                    className="text-gray-500 hover:text-gray-700 p-1.5 hover:bg-stone-100 rounded-full transition-colors"
                    aria-label="Close modal"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Select rewards to apply to your current order. You can combine multiple rewards when applicable.
              </p>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              {rewardsLoading && (
                <div className="flex-1 flex items-center justify-center py-10">
                  <div className="animate-pulse flex space-x-2 items-center">
                    <div className="h-3 w-3 bg-gray-400 rounded-full"></div>
                    <div className="h-3 w-3 bg-gray-400 rounded-full"></div>
                    <div className="h-3 w-3 bg-gray-400 rounded-full"></div>
                    <span className="text-sm text-gray-500">Loading rewards...</span>
                  </div>
                </div>
              )}
              
              {rewardsError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-5 text-center my-6">
                  <p className="text-red-600 font-medium">{rewardsError}</p>
                  <button 
                    onClick={fetchCustomerRewards}
                    className="mt-3 text-sm text-blue-600 hover:underline bg-blue-50 px-4 py-2 rounded-lg"
                  >
                    Try Again
                  </button>
                </div>
              )}
              
              {!rewardsLoading && !rewardsError && availableRewards.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 12H4m8-10v20m3-10l7-7m-7 7l-7-7" />
                                            </svg>
                  <p className="text-gray-500 font-medium text-lg">No Rewards Available</p>
                  <p className="text-sm text-gray-400 mt-2 max-w-xs">Continue ordering and earning points to unlock rewards and special offers!</p>
                </div>
              )}
              
              {!rewardsLoading && !rewardsError && availableRewards.length > 0 && (
                <div className="pr-2 scrollbar-thin scrollbar-thumb-stone-300 scrollbar-track-stone-100">
                  {/* Group rewards by type */}
                  {(() => {
                    // Group rewards by type for better organization
                    const vouchers = availableRewards.filter(r => r.isVoucher);
                    const discountRewards = availableRewards.filter(r => !r.isVoucher && (r.discountPercentage || r.discountFixedAmount));
                    const freeItemRewards = availableRewards.filter(r => !r.isVoucher && r.freeMenuItemIds && r.freeMenuItemIds.length > 0);
                    const otherRewards = availableRewards.filter(r => 
                      !r.isVoucher && 
                      !r.discountPercentage && 
                      !r.discountFixedAmount && 
                      (!r.freeMenuItemIds || r.freeMenuItemIds.length === 0)
                    );
                    
                    return (
                      <>
                        {/* Render each group with a heading */}
                        {vouchers.length > 0 && (
                          <div className="mb-8">
                            <h4 className="text-base font-medium text-gray-700 mb-3 border-b border-stone-200 pb-2">
                              Your Vouchers
                            </h4>
                            <div className="space-y-4">
                              {renderRewardsList(vouchers)}
                                        </div>
                                          </div>
                                        )}
                        
                        {discountRewards.length > 0 && (
                          <div className="mb-8">
                            <h4 className="text-base font-medium text-gray-700 mb-3 border-b border-stone-200 pb-2">
                              Discount Rewards
                            </h4>
                            <div className="space-y-4">
                              {renderRewardsList(discountRewards)}
                            </div>
                          </div>
                        )}
                        
                        {freeItemRewards.length > 0 && (
                          <div className="mb-8">
                            <h4 className="text-base font-medium text-gray-700 mb-3 border-b border-stone-200 pb-2">
                              Free Item Rewards
                            </h4>
                            <div className="space-y-4">
                              {renderRewardsList(freeItemRewards)}
                                    </div>
                                </div>
                        )}
                        
                        {otherRewards.length > 0 && (
                          <div className="mb-8">
                            <h4 className="text-base font-medium text-gray-700 mb-3 border-b border-stone-200 pb-2">
                              Other Rewards
                            </h4>
                            <div className="space-y-4">
                              {renderRewardsList(otherRewards)}
                            </div>
                    </div>
                )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
            
            <div className="p-5 border-t border-stone-200 bg-stone-50 flex justify-end space-x-3">
              {selectedRewards.length > 0 && (
                <button 
                  onClick={() => {
                    setSelectedRewards([]);
                    setDiscountAmount(0);
                    addFreeItemsToCart();
                    toast.info("All rewards have been removed");
                  }}
                  className="py-2 px-4 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                >
                  Remove All
                </button>
              )}
                    <button 
                        onClick={() => setShowRewardsModal(false)} 
                className="py-2.5 px-6 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
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

// --- Sub-Components --- 
interface MenuOptionSelectorProps {
    productId: string; 
    title: string;
    options: ProductOption[];
    selectedValue: string | string[]; // This now represents selected *option ID(s)*, not labels
    onChange: (optionId: string) => void; // Changed to pass optionId
    type: 'radio' | 'checkbox';
    labelColor?: string; 
    isRequired?: boolean; // New prop
    isErrored?: boolean; // New prop
}

const MenuOptionSelector: React.FC<MenuOptionSelectorProps> = ({ productId, title, options, selectedValue, onChange, type, labelColor = 'text-gray-700', isRequired, isErrored }) => {
  return (
    <div className={`py-1.5 ${isErrored ? 'bg-red-50 p-1.5 rounded-md' : ''}`}>
      <label className={`block text-xs font-medium ${labelColor} mb-0.5 flex justify-between`}>
        <span>{title} {isRequired && <span className="text-red-500">*</span>}</span>
        {options && options.length > 2 && <span className="text-xs text-stone-400">{type === 'radio' ? 'Choose one' : 'Select any'}</span>}
      </label>
      {options && options.length > 0 ? (
        <div className={`grid ${options.length > 3 ? 'grid-cols-2' : 'grid-cols-1'} gap-x-1 gap-y-0.5`}>
          {options.map(option => {
            const isSelected = type === 'radio' 
              ? selectedValue === option.id 
              : Array.isArray(selectedValue) && selectedValue.includes(option.id);
            return (
              <label 
                key={option.id} 
                className={`flex items-center space-x-1.5 p-1 rounded-md cursor-pointer text-xs transition-colors 
                    ${isSelected ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-stone-100'}`}
              >
                <input 
                  type={type} 
                  name={`${productId}-${title}`} // Ensure unique name for radio groups per product and category
                  value={option.id} // Value should be the option ID
                  checked={isSelected}
                  onChange={() => { 
                    if (typeof option.id === 'string') { 
                      onChange(option.id);
                    }
                  }} // Pass option ID only if it's a string
                  className={type === 'radio' ? "form-radio h-3 w-3 text-emerald-500 focus:ring-emerald-400" : "form-checkbox h-3 w-3 text-emerald-500 rounded focus:ring-emerald-400"}
                />
                <span className="flex-1 truncate" title={option.label}>{option.label}</span>
                {option.priceModifier !== undefined && option.priceModifier !== 0 && (
                  <span className={`text-xs ${option.priceModifier > 0 ? 'text-blue-600' : 'text-red-600'} whitespace-nowrap`}>
                    {option.priceModifier > 0 ? `+$${option.priceModifier.toFixed(2)}` : `-$${Math.abs(option.priceModifier).toFixed(2)}`}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-400">No options available for {title}.</p>
      )}
    </div>
  );
};

export default Menu; 