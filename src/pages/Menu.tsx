import React, { useState, useEffect, useRef } from 'react';
import { NewOrderData, PlacedOrderItemDetail, User, Product, ProductOption, OptionCategory } from '../types'; // Import NewOrderData, PlacedOrderItemDetail, and User from ../types

// Define interfaces for better type safety
// interface ProductOption { ... }
// interface Product { ... }

interface MenuOrderItem extends Omit<Product, 'optionCategories'> { // Use Omit to prevent clash, add specific fields
    quantity: number;
    // Store selections based on category ID
    selectedOptions: { [categoryId: string]: string | string[] }; // Stores OPTION IDs
    itemTotalPrice: number; // Price including selected option modifiers
}

// State for options selected on a *single* product card before adding to cart
interface CardSelectionState {
    [productId: string]: {
        quantity: number;
        // Store selected OPTION IDs based on category ID
        selectedOptions: { [categoryId: string]: string | string[] }; // e.g., { 'catId1': 'optionId3', 'catId4': ['optionId11', 'optionId12'] }
    };
}

// --- New State for tracking required option errors ---
// Key: productId, Value: array of categoryIds that are required but not selected
interface RequiredOptionErrors {
    [productId: string]: string[];
}

interface MenuPageProps {
  placeNewOrder: (orderData: NewOrderData) => void;
  user: User | null; // Add user prop
}

const Menu: React.FC<MenuPageProps> = ({ placeNewOrder, user }) => {
  // Product Fetching State
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  
  const [activeCategory, setActiveCategory] = useState<Product['category'] | 'All'>('All');
  const [currentOrder, setCurrentOrder] = useState<MenuOrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [cardSelections, setCardSelections] = useState<CardSelectionState>({});
  const customerNameInputRef = useRef<HTMLInputElement>(null); // Create a ref for the input

  // --- New state for product customization modal/view ---
  const [selectedProductForCustomization, setSelectedProductForCustomization] = useState<Product | null>(null);
  const [customizationOptions, setCustomizationOptions] = useState<OptionCategory[]>([]);
  const [customizationOptionsLoading, setCustomizationOptionsLoading] = useState<boolean>(false);
  const [customizationOptionsError, setCustomizationOptionsError] = useState<string | null>(null);
  const [requiredOptionErrors, setRequiredOptionErrors] = useState<RequiredOptionErrors>({});

  // --- State for caching fetched options ---
  const [optionsCache, setOptionsCache] = useState<Record<string, OptionCategory[]>>({});

  // State to track which item is being added to cart (for loading indicator)
  const [addingItemId, setAddingItemId] = useState<string | null>(null);

  // --- New State for Backend Categories ---
  const [fetchedCategories, setFetchedCategories] = useState<any[]>([]); // Use 'any' temporarily or define FetchedCategory interface if needed
  const [categoriesLoading, setCategoriesLoading] = useState<boolean>(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  // --- TEMPORARY DEBUG BUTTON --- 
  const handleClearOptionsCache = () => {
    setOptionsCache({});
    alert('Options cache cleared. Please try customizing/adding a product again.');
  };
  // --- END TEMPORARY DEBUG BUTTON ---

  // Effect to perform initial validation of required options for products
  // when products load or their options become available in the cache.
  useEffect(() => {
    if (productsLoading || categoriesLoading) return; // Wait for main data to load

    let didUpdateErrors = false;
    const newErrors: RequiredOptionErrors = { ...requiredOptionErrors };

    products.forEach(product => {
      const productOptions = optionsCache[product.id];
      // Only validate if options are loaded and we haven't processed this product's initial card state yet
      // OR if the product has errors but its options might have changed (e.g. is_required toggled elsewhere)
      // For simplicity, we re-validate if options are present. More granular control could check cardSelections.
      if (productOptions) {
        // Determine initial selections (typically empty for a new card)
        // If cardSelections[product.id] exists, it means user might have interacted.
        // For initial load validation, we care about the state *before* interaction.
        let currentProductSelections = cardSelections[product.id]?.selectedOptions;
        
        if (!currentProductSelections) {
          // Initialize temporary selectedOptions for validation if not in cardSelections
          currentProductSelections = {};
          productOptions.forEach(category => {
            currentProductSelections![category.id] = category.selectionType === 'radio' ? '' : [];
          });
        }
        
        const missingRequiredForProduct: string[] = [];
        productOptions.forEach(category => {
          if (category.is_required) {
            const selection = currentProductSelections![category.id];
            const isSelected = Array.isArray(selection) ? selection.length > 0 : (selection !== undefined && selection !== '');
            if (!isSelected) {
              missingRequiredForProduct.push(category.id);
            }
          }
        });

        if (missingRequiredForProduct.length > 0) {
          if (!newErrors[product.id] || newErrors[product.id].join(',') !== missingRequiredForProduct.join(',')) {
            newErrors[product.id] = missingRequiredForProduct;
            didUpdateErrors = true;
          }
        } else {
          if (newErrors[product.id]) {
            delete newErrors[product.id];
            didUpdateErrors = true;
          }
        }
      }
    });

    if (didUpdateErrors) {
      setRequiredOptionErrors(newErrors);
    }
  }, [products, optionsCache, productsLoading, categoriesLoading, cardSelections]); // cardSelections is added to re-evaluate if user selections clear errors

  // Fetch Products
  useEffect(() => {
    const fetchProductsAndTheirOptions = async () => {
      setProductsLoading(true);
      setProductsError(null);
      let fetchedProducts: Product[] = [];

      try {
        const response = await fetch('http://localhost:3001/api/products');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const mappedProducts: Product[] = data.map((p: any) => ({
          id: p.product_id,
          name: p.name,
          price: parseFloat(p.base_price),
          image: p.image_url || '/src/assets/product.png',
          category: p.category_name,
          description: p.description,
          optionCategories: [], // Options will be fetched next
          availability: p.availability,
          tags: p.tags ? p.tags.split(',') : [],
        }));
        setProducts(mappedProducts);
        fetchedProducts = mappedProducts; // Store for option fetching
      } catch (error: any) {
        console.error("Failed to fetch products:", error);
        setProductsError(`Failed to load products: ${error.message}`);
        setProductsLoading(false); // Ensure loading is false on error
        return; // Stop if products fail
      }
      // Products loaded, now set productsLoading to false
      setProductsLoading(false);

      // After products are loaded, fetch options for all of them if not already cached
      // This runs after setProductsLoading(false) so the validation useEffect can react properly
      if (fetchedProducts.length > 0) {
        const optionFetchPromises = fetchedProducts.map(product => {
          if (!optionsCache[product.id]) {
            return fetch(`http://localhost:3001/api/products/${product.id}/options`)
              .then(response => {
                if (!response.ok) {
                  if (response.status === 404) return []; // No options, not an error
                  throw new Error(`Options HTTP error! S: ${response.status} for P: ${product.id}`);
                }
                return response.json();
              })
              .then((optionsData: OptionCategory[]) => {
                const mappedOptions = optionsData.map(cat => ({
                  ...cat,
                  id: String(cat.id),
                  is_required: !!cat.is_required,
                  options: cat.options.map(opt => ({ ...opt, id: String(opt.id) }))
                }));
                return { productId: product.id, options: mappedOptions };
              })
              .catch(err => {
                console.warn(`Failed to fetch options for product ${product.id}:`, err.message);
                return { productId: product.id, options: [] }; // Cache empty options on error to prevent re-fetch
              });
          }
          return Promise.resolve(null); // Already cached or no fetch needed
        });

        Promise.all(optionFetchPromises).then(results => {
          const newCacheEntries: Record<string, OptionCategory[]> = {};
          let updatedCache = false;
          results.forEach(result => {
            if (result && result.options) { // Ensure result is not null and has options
              newCacheEntries[result.productId] = result.options;
              updatedCache = true;
            }
          });
          if (updatedCache) {
            setOptionsCache(prevCache => ({ ...prevCache, ...newCacheEntries }));
          }
        });
      }
    };
    fetchProductsAndTheirOptions();
  }, []); // Keep this effect running only once on mount

  // --- Fetch Categories from Backend --- 
  useEffect(() => {
    const fetchCategories = async () => {
      setCategoriesLoading(true);
      setCategoriesError(null);
      try {
        // No auth needed for public categories based on server.js
        const response = await fetch('http://localhost:3001/api/categories');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setFetchedCategories(data); 
        // Keep 'All' as the default active category, no need to change it here
      } catch (error: any) {
        console.error("Failed to fetch categories:", error);
        setCategoriesError(`Failed to load categories: ${error.message}`);
      } finally {
        setCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []); // Fetch categories on mount

  // Filter products based on active category
  const filteredProducts = activeCategory === 'All'
    ? products
    : products.filter(p => p.category === activeCategory);

  // Initialize or get state for a specific product card
  const getCardState = (productId: string, product: Product | undefined) => {
      if (!product) {
          return { quantity: 1, selectedOptions: {} };
      }

      const existingCardSelection = cardSelections[productId];
      if (existingCardSelection) {
        // If we have a selection, assume options were fetched and validated already
        // or will be by other mechanisms.
        return existingCardSelection;
      }

      // If no card selection exists yet, this is the initial setup for the card.
      // We need to ensure options are present to correctly initialize selectedOptions
      // and to validate required ones for the button's initial state.

      const productOptionsFromCache = optionsCache[productId];
      let initialSelectedOptions: { [categoryId: string]: string | string[] } = {};

      if (productOptionsFromCache) {
        // Options are in cache, initialize and validate
        productOptionsFromCache.forEach(category => {
            if (category.selectionType === 'radio') {
                initialSelectedOptions[category.id] = ''; // Initialize radio as unselected
            } else { // checkbox
                initialSelectedOptions[category.id] = []; // Start with nothing selected for checkbox groups
            }
        });
        // Perform initial validation for required options
        const missingRequired: string[] = [];
        productOptionsFromCache.forEach(category => {
            if (category.is_required) {
                const selection = initialSelectedOptions[category.id];
                const isSelected = Array.isArray(selection) ? selection.length > 0 : !!selection;
                if (!isSelected) {
                    missingRequired.push(category.id);
                }
            }
        });
        if (missingRequired.length > 0) {
            // Update requiredOptionErrors state. This needs to be done carefully
            // to avoid infinite loops if getCardState is called in render.
            // Deferring the direct state update from here, but the button can use missingRequired.
            // For now, let's log and see. The main validation still happens in handleAddToCart and updateCardState.
             console.log(`[getCardState] Product ${productId} missing required:`, missingRequired);
             // We will ensure requiredOptionErrors is updated when options are fetched in the useEffect for products.
        }
      } else {
        // Options not in cache. They will be fetched by the useEffect that watches selectedProductForCustomization
        // or we might need a mechanism to fetch them for all visible cards if direct "Add to Cart" is possible
        // without opening customize modal. For now, default to empty selections.
        // The "Add to Cart" button might be overly restrictive or permissive until options load.
        console.warn(`[getCardState] Options not in cache for ${productId}. Initial button state might be inaccurate.`);
      }
      
      return {
          quantity: 1,
          selectedOptions: initialSelectedOptions,
      };
  };

  // Update state for a specific product card
  const updateCardState = (productId: string, updates: Partial<{ quantity: number; selectedOptions: { [categoryId: string]: string | string[] } }>) => {
      const product = products.find(p => p.id === productId);
      if (!product) return; // Add guard clause
      
      const currentCardState = getCardState(productId, product); 
      
      const newSelectedOptions = updates.selectedOptions 
          ? { ...currentCardState.selectedOptions, ...updates.selectedOptions } 
          : currentCardState.selectedOptions;
      
      const newQuantity = updates.quantity !== undefined ? updates.quantity : currentCardState.quantity;

      setCardSelections(prev => ({
          ...prev,
          [productId]: { 
              quantity: newQuantity,
              selectedOptions: newSelectedOptions, // Use the updated selections
           }
      }));

      // Update requiredOptionErrors based on changes
      if (updates.selectedOptions) {
        const productOptionCategories = optionsCache[productId] || customizationOptions; 
        Object.keys(updates.selectedOptions).forEach(categoryId => {
            const category = productOptionCategories.find(cat => cat.id === categoryId);
            if (category && category.is_required) {
                const selection = newSelectedOptions[categoryId];
                const isSelected = Array.isArray(selection) ? selection.length > 0 : !!selection;
                
                setRequiredOptionErrors(prevErrors => {
                    const existingProductErrors = prevErrors[productId] || [];
                    let newProductErrors = [...existingProductErrors];

                    if (isSelected) {
                        // If selected, remove this categoryId from errors
                        newProductErrors = newProductErrors.filter(errCatId => errCatId !== categoryId);
                    } else {
                        // If not selected (and was required), add this categoryId to errors (if not already present)
                        if (!newProductErrors.includes(categoryId)) {
                            newProductErrors.push(categoryId);
                        }
                    }

                    if (newProductErrors.length === 0) {
                        // If no errors left for this product, remove the product key
                        const { [productId]: _, ...rest } = prevErrors;
                        return rest;
                    }
                    return {
                        ...prevErrors,
                        [productId]: newProductErrors,
                    };
                });
            }
        });
      }
  };

  // Generic handler for option changes (now receives optionId)
  const handleOptionChange = (productId: string, categoryId: string, selectionType: 'radio' | 'checkbox', optionId: string) => { // Changed last param
      const product = products.find(p => p.id === productId);
      if (!product) return;
      const currentCardState = getCardState(productId, product); 
      const currentSelection = currentCardState.selectedOptions[categoryId];
      let newSelection: string | string[];

      if (selectionType === 'radio') {
          // Allow deselecting by clicking the already selected radio option
          newSelection = currentSelection === optionId ? '' : optionId; 
      } else { // checkbox
          const currentArray = Array.isArray(currentSelection) ? currentSelection : [];
          if (currentArray.includes(optionId)) {
              newSelection = currentArray.filter(id => id !== optionId); // Deselect ID
          } else {
              newSelection = [...currentArray, optionId]; // Select ID
          }
      }
      
      updateCardState(productId, { 
          selectedOptions: { [categoryId]: newSelection } 
      });
  };

  // Calculate total price for a MenuOrderItem, including base price and option modifiers
  const calculateItemTotalPrice = (
    basePrice: number, // Changed from product: Product
    quantity: number, 
    selectedOptions: { [categoryId: string]: string | string[] },
    optionCategories: OptionCategory[] // Added explicit parameter
  ): number => {
      let price = basePrice; // Use basePrice passed in
      // Iterate over the passed optionCategories
      optionCategories?.forEach(category => { 
          const selection = selectedOptions[category.id];
          if (selection) {
              const optionsToConsider = Array.isArray(selection) ? selection : [selection];
              optionsToConsider.forEach(selectedId => { // Changed variable name to selectedId
                  // Find option by ID, ensuring comparison robustness (e.g., string vs number)
                  const chosenOption = category.options.find(opt => String(opt.id) === String(selectedId)); 
                  if (chosenOption?.priceModifier) {
                      price += chosenOption.priceModifier;
                  }
              });
          }
      });
      return price * quantity;
  };

  // Add item to the current order list
  const handleAddToCart = async (product: Product) => {
     setAddingItemId(product.id); // Set loading state for this item
     // Clear previous errors for this product before validation
     setRequiredOptionErrors(prevErrors => {
        const { [product.id]: _, ...rest } = prevErrors;
        return rest;
     });

     try {
       // 1. Get selections from state
       const selections = getCardState(product.id, product);
       
       // 2. Get option categories for this product (from cache or fetch)
       let fetchedOptionCategories: OptionCategory[];
       if (optionsCache[product.id]) {
         fetchedOptionCategories = optionsCache[product.id];
       } else {
         try {
           const response = await fetch(`http://localhost:3001/api/products/${product.id}/options`);
           if (!response.ok) {
             if (response.status === 404) {
               fetchedOptionCategories = []; // Product has no options
             } else {
               throw new Error(`HTTP error fetching options! status: ${response.status}`);
             }
           } else {
             const data: OptionCategory[] = await response.json();
             fetchedOptionCategories = data.map(cat => ({
               ...cat,
               id: String(cat.id),
               is_required: !!cat.is_required, // Ensure boolean
               options: cat.options.map(opt => ({ ...opt, id: String(opt.id) }))
             }));
           }
           // Store fetched options in cache
           setOptionsCache(prev => ({ ...prev, [product.id]: fetchedOptionCategories }));
         } catch (fetchError: any) {
           console.error("Failed to fetch options before adding to cart:", fetchError);
           alert(`Could not load options for ${product.name}. Please try again.`);
           setAddingItemId(null);
           return; // Stop adding to cart if options fail to load
         }
       }

       // VALIDATION FOR REQUIRED OPTIONS
       const missingRequiredCategories: string[] = [];
       fetchedOptionCategories.forEach(category => {
           if (category.is_required) {
               const selection = selections.selectedOptions[category.id];
               const isSelected = Array.isArray(selection) ? selection.length > 0 : !!selection;
               if (!isSelected) {
                   missingRequiredCategories.push(category.id);
               }
           }
       });

       if (missingRequiredCategories.length > 0) {
           setRequiredOptionErrors(prevErrors => ({
               ...prevErrors,
               [product.id]: missingRequiredCategories
           }));
           console.warn(`Product ${product.name} has missing required options for categories:`, missingRequiredCategories.join(', '));
           // alert(`Please select all required options for ${product.name}.`); // Keep alert less intrusive for now
           setAddingItemId(null); // Clear loading state
           return; // Stop adding to cart
       }
       // END VALIDATION

       // 3. Calculate price using fetched/cached options
       const calculatedPrice = calculateItemTotalPrice(
         product.price, // Pass base price
         selections.quantity, 
         selections.selectedOptions, 
         fetchedOptionCategories // Pass fetched options
       );

       // 4. Create the order item
       const newItem: MenuOrderItem = {
           id: product.id,
           name: product.name,
           price: product.price, // Base price stored separately
           image: product.image,
           category: product.category,
           description: product.description,
           availability: product.availability,
           tags: product.tags,
           quantity: selections.quantity,
           selectedOptions: selections.selectedOptions,
           itemTotalPrice: calculatedPrice, // Store calculated total price
       };
       setCurrentOrder(prevOrder => [...prevOrder, newItem]);
       console.log("Added to order:", newItem);

     } finally {
       setAddingItemId(null); // Clear loading state for this item
     }
  };

  // Calculate totals (now uses itemTotalPrice from MenuOrderItem)
  const subtotal = currentOrder.reduce((sum, item) => sum + item.itemTotalPrice, 0);
  // SECURITY NOTE: Discount logic remains client-side for UI; server MUST validate.
  const discountAmount = 0; // Set discount to 0
  const total = subtotal - discountAmount;

  const handleRemoveFromOrder = (indexToRemove: number) => {
        setCurrentOrder(prevOrder => prevOrder.filter((_, index) => index !== indexToRemove));
   };

   const clearFullOrderDetails = () => {
    setCurrentOrder([]);
    setCustomerName('');
    setCardSelections({});
   };

   const handleClearOrder = () => {
        if (window.confirm("Are you sure you want to clear the current order?")) {
            clearFullOrderDetails();
        }
   };

   // Prepare order for placing (backend call)
   const handleCheckout = async () => {
    if (currentOrder.length === 0) {
      alert('Please add items to your order first.'); return;
    }

    let finalCustomerName = customerName.trim();

    if (!finalCustomerName) { // If trimmed customerName from input is empty
        if (user && user.name) {
            finalCustomerName = user.name;
            console.log(`Customer name input was blank, using logged-in user's name: ${finalCustomerName}`);
        } else {
            // If input is blank AND user.name is not available, prompt.
            alert('Please enter a customer name, or ensure the logged-in user has a name defined.');
            customerNameInputRef.current?.focus();
            return;
        }
    }

    const orderToPlace: NewOrderData = {
      customerName: finalCustomerName, // Use the derived or entered name
      items: currentOrder.map(item => {
          // Send selectedOptionIds (which now contains IDs)
          const placedItem: PlacedOrderItemDetail = {
            productId: item.id, 
            name: item.name,
            quantity: item.quantity,
            selectedOptionIds: item.selectedOptions, // Pass the ID map
          };
          return placedItem;
      }),
      // totalAmount is removed
    };

    try {
      await placeNewOrder(orderToPlace);
      alert('Order placed successfully!');
      clearFullOrderDetails();
    } catch (error) {
      console.error("Failed to place order:", error);
      alert(`Failed to place order. Please try again. ${error instanceof Error ? error.message : ''}`);
    }
   };

  // Pre-fill customer name if user is customer
  useEffect(() => {
    if (user && user.role === 'customer' && user.name) {
      setCustomerName(user.name);
    }
    // Only run on initial mount or if user changes
  }, [user]);

  // --- Fetch options when a product is selected for customization ---
  useEffect(() => {
    if (!selectedProductForCustomization) {
      setCustomizationOptions([]);
      // DO NOT CLEAR requiredOptionErrors here. Errors should persist based on selection state.
      return;
    }

    const currentProductId = selectedProductForCustomization.id;

    const fetchProductOptionsAndValidate = async () => {
      setCustomizationOptionsLoading(true);
      setCustomizationOptionsError(null);
      let fetchedOptionCategories: OptionCategory[];

      if (optionsCache[currentProductId]) {
        fetchedOptionCategories = optionsCache[currentProductId];
        setCustomizationOptions(fetchedOptionCategories); // Set them for the modal
      } else {
        try {
          const response = await fetch(`http://localhost:3001/api/products/${currentProductId}/options`);
          if (!response.ok) {
            if (response.status === 404) {
              fetchedOptionCategories = [];
            } else {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
          } else {
            const data: OptionCategory[] = await response.json();
            fetchedOptionCategories = data.map(cat => ({
              ...cat,
              id: String(cat.id),
              is_required: !!cat.is_required,
              options: cat.options.map(opt => ({ ...opt, id: String(opt.id) }))
            }));
          }
          setOptionsCache(prev => ({ ...prev, [currentProductId]: fetchedOptionCategories }));
          setCustomizationOptions(fetchedOptionCategories); // Set them for the modal
        } catch (error: any) {
          console.error("Failed to fetch customization options:", error);
          setCustomizationOptionsError(`Failed to load options: ${error.message}`);
          setCustomizationOptionsLoading(false);
          return; // Stop if options fail to load
        }
      }
      setCustomizationOptionsLoading(false);

      // Now, validate required options for the modal and update errors
      // This also implicitly initializes cardSelections if it wasn't already
      const currentSelections = getCardState(currentProductId, selectedProductForCustomization).selectedOptions;
      const missingRequired: string[] = [];
      fetchedOptionCategories.forEach(category => {
          if (category.is_required) {
              const selection = currentSelections[category.id];
              // For radio, an empty string means nothing selected. For checkbox, an empty array.
              const isSelected = Array.isArray(selection) ? selection.length > 0 : (selection !== undefined && selection !== '');
              if (!isSelected) {
                  missingRequired.push(category.id);
              }
          }
      });

      if (missingRequired.length > 0) {
          setRequiredOptionErrors(prevErrors => ({
              ...prevErrors,
              [currentProductId]: missingRequired
          }));
      } else {
          // Clear errors for this product if all required are now met
          setRequiredOptionErrors(prevErrors => {
              const { [currentProductId]: _, ...rest } = prevErrors;
              return rest;
          });
      }
    };

    fetchProductOptionsAndValidate();
  }, [selectedProductForCustomization, optionsCache]); // Add optionsCache dependency

  return (
    <div className="flex gap-6 h-[calc(100vh-theme(space.24))] jurors"> {/* Adjust height based on layout */}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-semibold text-gray-800">Kitchen</h1>
              <div className="relative w-64">
                  <input 
                      type="text" 
                      placeholder="Search for a product..." 
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm text-gray-800 pl-10"
                  />
                  <img src="/src/assets/search.svg" alt="Search" className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
          </div>

        {/* Category Filters - Updated to be dynamic */}
        <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
          {/* 'All' Category Button */}
          <button
            key="All"
            onClick={() => setActiveCategory('All')}
            className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors flex-shrink-0 ${ 
              activeCategory === 'All'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-stone-200'
            }`}
          >
             All Products
          </button>

          {/* Dynamic Category Buttons */}
          {categoriesLoading && <p className="text-gray-500 text-sm p-2">Loading...</p>}
          {categoriesError && <p className="text-red-500 text-sm p-2">Error loading categories</p>}
          {!categoriesLoading && !categoriesError && fetchedCategories.map(category => (
            <button
              key={category.category_id} // Use category_id as key
              onClick={() => setActiveCategory(category.name)} // Set active category by name
              className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors flex-shrink-0 ${ 
                activeCategory === category.name // Check against name
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-stone-200'
              }`}
            >
                {/* Optional: Add category image logic here if needed */}
                {/* {category.image_url && <img src={category.image_url} alt="" className="w-4 h-4 opacity-80" />} */}
                {category.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
         <p className="text-sm text-gray-600 mb-4">{productsLoading ? 'Loading...' : `${filteredProducts.length} products available`}</p>
         {productsLoading && <p className="text-gray-500">Loading products...</p>}
         {productsError && <p className="text-red-500">{productsError}</p>}
         {!productsLoading && !productsError && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 overflow-y-auto pr-2 flex-1"> 
            {filteredProducts.map(product => {
              const cardState = getCardState(product.id, product);
              const isAvailable = product.availability !== 'unavailable';
              const isLimited = product.availability === 'limited';

              return (
                  <div 
                    key={product.id} 
                    className={`bg-white rounded-2xl p-4 shadow-sm border border-stone-200 flex flex-col relative ${!isAvailable ? 'opacity-60' : ''}`}
                  >
                  {/* Availability Indicator */} 
                  {!isAvailable && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full z-10">
                      Unavailable
                    </div>
                  )}
                  {isLimited && !isAvailable && (
                    <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full z-10">
                      Limited Stock
                    </div>
                  )}

                  <img src={product.image || '/src/assets/product.png'} alt={product.name} className="w-24 h-24 object-contain mx-auto mb-3" />
                  <h3 className="text-md font-semibold text-gray-800 mb-1 text-center">{product.name}</h3>
                  <p className="text-sm text-gray-700 text-center mb-3">${product.price.toFixed(2)}</p>
                  
                  {/* Interactive Product Options - Now displays Description */}
                  <div className="space-y-3 text-xs mb-4 flex-1">
                      {/* Display Description if available, otherwise nothing */}
                      {product.description ? (
                          <p className="text-center text-gray-500 italic text-xs px-2">
                              {product.description}
                          </p>
                      ) : (
                          <div className="h-4"></div> // Placeholder for spacing if no description
                      )}
                  </div>
                  
                  {/* Quantity and Add Button */}
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-stone-200">
                       <div className="flex items-center space-x-1">
                          <button onClick={() => updateCardState(product.id, { quantity: Math.max(1, cardState.quantity - 1) })} className="quantity-button">-</button>
                          <span className="font-medium w-6 text-center text-sm text-gray-800">{cardState.quantity}</span>
                          <button onClick={() => updateCardState(product.id, { quantity: cardState.quantity + 1 })} className="quantity-button" disabled={!isAvailable}>+</button>
                       </div>
                       <button 
                        onClick={() => setSelectedProductForCustomization(product)} 
                        className="px-3 py-1.5 bg-stone-200 text-stone-700 rounded-lg text-xs hover:bg-stone-300 transition-colors mr-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!isAvailable} // Disable if unavailable
                       >
                         Customize
                       </button>
                       <button 
                          onClick={() => handleAddToCart(product)}
                          className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${(!isAvailable || addingItemId === product.id || (requiredOptionErrors[product.id] && requiredOptionErrors[product.id].length > 0)) ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                          disabled={!isAvailable || addingItemId === product.id || (requiredOptionErrors[product.id] && requiredOptionErrors[product.id].length > 0)} // Disable while adding, if unavailable, or if required options have errors
                       >
                          {addingItemId === product.id ? 'Adding...' : 'Add to cart'} 
                      </button>
                  </div>
                  </div>
              );
            })}
            {filteredProducts.length === 0 && (
               <p className="text-gray-500 col-span-full text-center mt-10">No products found{productSearchTerm ? ` matching "${productSearchTerm}"` : ''}.</p>
            )}
          </div>
         )}
      </div>

      {/* Order Details Sidebar */}
      <div className="w-80 bg-white rounded-2xl p-5 shadow-sm flex flex-col border border-stone-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Order Details</h2>
             <button 
                 onClick={handleClearOrder}
                 title="Clear Order"
                 className="action-button-red">
                 <img src="/src/assets/delete.svg" alt="Clear Order" className="w-4 h-4" /> 
            </button>
          </div>

          <div className="mb-4">
              <label htmlFor="customerName" className="block text-xs font-medium text-gray-600 mb-1">Customer Name</label>
              <input 
                type="text" 
                id="customerName"
                ref={customerNameInputRef}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={user?.role === 'customer' ? user.name : "Enter name for order"}
                className="form-input"
              />
           </div>

          {/* Order Items List */}
           <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4 border-t border-b border-stone-200 py-3">
                {currentOrder.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-10">Order is empty</p>
                )}
                {currentOrder.map((item, index) => {
                    // Function to get option labels from IDs using cached options
                    const getOptionLabels = (productId: string, selectedOptions: { [categoryId: string]: string | string[] }): string[] => {
                        const productOptionCategories = optionsCache[productId];
                        if (!productOptionCategories) return []; // No options cached for this product
                        const labels: string[] = [];
                        productOptionCategories.forEach(category => {
                            const selection = selectedOptions[category.id];
                            if (!selection) return; // No selection for this category
                            const selectedIds = Array.isArray(selection) ? selection : [selection];
                            selectedIds.forEach(selectedId => {
                                const option = category.options.find(opt => String(opt.id) === String(selectedId));
                                if (option) {
                                    labels.push(option.label);
                                }
                            });
                        });
                        return labels;
                    };
                    const optionLabels = getOptionLabels(item.id, item.selectedOptions);

                    return (
                        <li key={index} className="flex justify-between items-start py-3">
                            <div className="flex items-start space-x-3 flex-1">
                                <img src={item.image} alt={item.name} className="w-10 h-10 object-contain rounded-md bg-gray-100 p-0.5 border"/>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-800">{item.quantity}x {item.name}</p>
                                    {/* Display selected option labels */}
                                    {optionLabels.length > 0 && (
                                        <p className="text-xs text-gray-500">
                                            {optionLabels.join(' • ')}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col items-end ml-3">
                                <p className="text-sm font-medium text-gray-900">${item.itemTotalPrice.toFixed(2)}</p>
                                <button onClick={() => handleRemoveFromOrder(index)} className="text-xs text-red-500 hover:text-red-700 mt-1">Remove</button>
                            </div>
                        </li>
                    );
                })}
           </div>

          {/* Order Summary */}
          <div className="space-y-1 text-sm mb-4">
              <div className="flex justify-between text-gray-700">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
              </div>
              {/* Discount display removed until implemented via backend/rewards */}
              {/* <div className="flex justify-between text-gray-700">
                   <span>Discount</span> 
                   <span className="text-red-600">-${discountAmount.toFixed(2)}</span>
              </div> */}
              <div className="flex justify-between font-semibold text-lg text-gray-800 pt-1 border-t border-stone-200 mt-2">
                  <span>TOTAL</span>
                  <span>${total.toFixed(2)}</span>
              </div>
          </div>

          {/* Action Button */}
          <button 
            onClick={handleCheckout}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 transition-colors font-semibold text-md mt-auto"
            disabled={currentOrder.length === 0}
          >
              Check Out
          </button>
      </div>

      {/* Customization Modal */}
      {selectedProductForCustomization && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Customize: {selectedProductForCustomization.name}</h2>
            </div>

            {customizationOptionsLoading && <p className="text-center text-gray-600 py-4">Loading options...</p>}
            {customizationOptionsError && <p className="text-center text-red-500 py-4">Error: {customizationOptionsError}</p>}
            
            {!customizationOptionsLoading && !customizationOptionsError && (
              <div className="overflow-y-auto flex-1 mb-4 pr-2 space-y-4">
                {/* Product Details */}
                <div className="mb-4 border-b border-gray-100 pb-4">
                    <div className="flex items-start gap-4">
                        <img 
                            src={selectedProductForCustomization.image} 
                            alt={selectedProductForCustomization.name} 
                            className="w-20 h-20 object-contain bg-white rounded-lg p-1 border border-gray-200"
                        />
                        <div className="flex-1">
                            <h3 className="text-xl font-semibold text-gray-800">{selectedProductForCustomization.name}</h3>
                            <p className="text-sm text-green-600 font-medium">Base Price: ${selectedProductForCustomization.price.toFixed(2)}</p>
                            {/* Display Description Here */}
                            {selectedProductForCustomization.description ? (
                                <p className="text-xs text-gray-500 mt-1">{selectedProductForCustomization.description}</p>
                            ) : (
                                <p className="text-xs text-gray-400 italic mt-1">No description available.</p>
                            )}
                        </div>
                    </div>
                </div>

                {customizationOptions.length === 0 && <p className="text-gray-500">This product has no customizable options.</p>}
                {customizationOptions.map(category => {
                  // Get the current selections for this product and this specific category
                  const productSelections = cardSelections[selectedProductForCustomization!.id]?.selectedOptions || {};
                  const categorySelection = productSelections[category.id] || (category.selectionType === 'checkbox' ? [] : '');
                  const categoryIsErrored = requiredOptionErrors[selectedProductForCustomization!.id]?.includes(category.id);
                  
                  return (
                    <MenuOptionSelector
                      key={category.id}
                      productId={selectedProductForCustomization!.id} // Pass product ID
                      title={category.name}
                      options={category.options || []}
                      selectedValue={categorySelection}
                      onChange={(optionId) => handleOptionChange(selectedProductForCustomization!.id, category.id, category.selectionType, optionId)}
                      type={category.selectionType}
                      isRequired={category.is_required} // Pass is_required
                      isErrored={!!categoryIsErrored} // Pass error state
                    />
                  );
                })}
              </div>
            )}

            <div className="mt-auto pt-4 border-t border-gray-200 flex justify-end space-x-3">
              <button 
                onClick={() => {
                   // Before closing, ensure errors are cleared if they were resolved by selections in modal
                   if (selectedProductForCustomization) {
                     const currentProductId = selectedProductForCustomization.id;
                     const currentSelections = getCardState(currentProductId, selectedProductForCustomization).selectedOptions;
                     const productOptions = optionsCache[currentProductId] || customizationOptions;
                     const missingRequiredStill: string[] = [];
                      productOptions.forEach(category => {
                        if (category.is_required) {
                          const selection = currentSelections[category.id];
                           const isSelected = Array.isArray(selection) ? selection.length > 0 : (selection !== undefined && selection !== '');
                          if (!isSelected) {
                            missingRequiredStill.push(category.id);
                          }
                        }
                      });
                      if (missingRequiredStill.length === 0) {
                        setRequiredOptionErrors(prevErrors => {
                            const { [currentProductId]: _, ...rest } = prevErrors;
                            return rest;
                        });
                      } else {
                         setRequiredOptionErrors(prevErrors => ({
                            ...prevErrors,
                            [currentProductId]: missingRequiredStill
                         }));
                      }
                   }
                  setSelectedProductForCustomization(null);
                }} 
                className="form-cancel-button px-5 py-2"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  // Here, selections would already be in `cardSelections` via OptionSelector component
                  // Re-validate before closing and "Done" to update errors for the main page button
                   if (selectedProductForCustomization) {
                     const currentProductId = selectedProductForCustomization.id;
                     const currentSelections = getCardState(currentProductId, selectedProductForCustomization).selectedOptions;
                     const productOptions = optionsCache[currentProductId] || customizationOptions; // Use cached or modal's options
                     const missingRequiredStill: string[] = [];
                      productOptions.forEach(category => {
                        if (category.is_required) {
                          const selection = currentSelections[category.id];
                           const isSelected = Array.isArray(selection) ? selection.length > 0 : (selection !== undefined && selection !== '');
                          if (!isSelected) {
                            missingRequiredStill.push(category.id);
                          }
                        }
                      });

                      if (missingRequiredStill.length > 0) {
                          setRequiredOptionErrors(prevErrors => ({
                              ...prevErrors,
                              [currentProductId]: missingRequiredStill
                          }));
                      } else {
                          setRequiredOptionErrors(prevErrors => {
                              const { [currentProductId]: _, ...rest } = prevErrors;
                              return rest;
                          });
                      }
                   }
                  setSelectedProductForCustomization(null);
                }} 
                className="form-save-button px-5 py-2"
              >
                Done Customizing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Helper Component for Options within Menu.tsx ---
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
    if (!options || options.length === 0) return null;

    const inputName = `${type}-${title.replace(/\s+/g, '_').toLowerCase()}-${productId}`;
    const titleDisplay = isRequired ? `${title} *` : title;

    return (
        <div className={`py-2 px-1 border rounded-lg bg-stone-50/50 ${isErrored ? 'border-red-500 ring-1 ring-red-500' : 'border-stone-200'}`}>
            <label className={`block text-sm font-medium ${labelColor} mb-1.5 px-2 ${isErrored ? 'text-red-600' : ''}`}>
                {titleDisplay}
                {isRequired && !isErrored && <span className="text-xs text-gray-500 ml-1">(required)</span>}
                {isErrored && <span className="text-xs text-red-500 ml-1 font-semibold"> (Selection required)</span>}
            </label>
            <div className="flex flex-wrap gap-2 px-2 pb-1">
                {options.map(option => {
                    // Ensure option.id exists and is a string before using it
                    const optionIdStr = option.id ? String(option.id) : undefined;
                    if (!optionIdStr) {
                        console.warn('Option missing ID:', option);
                        return null; // Skip rendering if option has no ID
                    }

                    const uniqueOptionDomId = `${inputName}-${optionIdStr}`;
                    const isSelected = type === 'radio' 
                        ? selectedValue === optionIdStr // Compare IDs
                        : Array.isArray(selectedValue) && selectedValue.includes(optionIdStr); // Compare IDs
                    
                    return (
                         <button 
                             key={uniqueOptionDomId} 
                             type="button"
                             onClick={() => onChange(optionIdStr)} // Pass optionIdStr to onChange
                             className={`px-3 py-1.5 rounded-lg text-xs border font-medium transition-colors min-w-[60px] ${isSelected ? 'bg-emerald-600 text-white border-emerald-700 ring-1 ring-emerald-500' : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-100 hover:border-stone-400'}`}>
                             {option.label} {option.priceModifier ? `(+$${option.priceModifier.toFixed(2)})` : ''}
                         </button>
                     );
                })}
            </div>
        </div>
    );
};

export default Menu; 