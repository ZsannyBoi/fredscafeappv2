import React, { useState, useEffect, useRef } from 'react';
import { NewOrderData, PlacedOrderItemDetail, User, Product, ProductOption, OptionCategory } from '../types'; // Import NewOrderData, PlacedOrderItemDetail, and User from ../types

// Define interfaces for better type safety
// interface ProductOption { ... }
// interface Product { ... }

interface MenuOrderItem extends Omit<Product, 'optionCategories'> { // Use Omit to prevent clash, add specific fields
    quantity: number;
    // Store selections based on category ID
    selectedOptions: { [categoryId: string]: string | string[] }; // e.g., { size: "M", toppings: ["Syrup", "Drizzle"] }
    itemTotalPrice: number; // Price including selected option modifiers
}

// Sample Product Data (Updated to use optionCategories structure)
const sampleProducts: Product[] = [
  {
    id: 'prod-1', name: 'Hot Caramel Macchiato', price: 5.99, image: '/src/assets/coffee-cup.png', category: 'Coffee',
    description: 'Rich espresso with vanilla-flavored syrup, steamed milk, and caramel sauce.',
    optionCategories: [
      { id: 'size', name: 'Size', selectionType: 'radio', options: [{ id:'s1', label: 'S' }, { id:'s2', label: 'M' }, { id:'s3', label: 'L' }] },
      { id: 'sugarLevel', name: 'Sugar Level', selectionType: 'radio', options: [{ id:'su1', label: '30%' }, { id:'su2', label: '50%' }, { id:'su3', label: '70%' }, { id:'su4', label: '100%' }] },
      { id: 'milk', name: 'Milk', selectionType: 'radio', options: [{ id:'m1', label: 'Dairy' }, { id:'m2', label: 'Almond', priceModifier: 0.5 }, { id:'m3', label: 'Soy', priceModifier: 0.5 }] },
      { id: 'temperature', name: 'Temperature', selectionType: 'radio', options: [{id: 't1', label: 'Hot' }] }, // Example: Only hot available for this specific drink
      { id: 'custom', name: 'Customize', selectionType: 'checkbox', options: [{id:'c1', label: 'Extra Caramel', priceModifier: 0.75}] },
    ],
    availability: 'available', tags: ['popular']
  },
   {
    id: 'prod-2', name: 'Iced Vanilla Latte', price: 4.99, image: '/src/assets/coffee-cup.png', category: 'Coffee',
    description: 'Cool and creamy iced latte with a sweet vanilla flavor.',
    optionCategories: [
      { id: 'size', name: 'Size', selectionType: 'radio', options: [{id:'s2', label: 'M' }, { id:'s3', label: 'L' }] },
      { id: 'sugarLevel', name: 'Sugar Level', selectionType: 'radio', options: [{ id:'su1', label: '30%' }, { id:'su2', label: '50%' }, { id:'su3', label: '70%' }, { id:'su4', label: '100%' }] },
      { id: 'milk', name: 'Milk', selectionType: 'radio', options: [{ id:'m1', label: 'Dairy' }, { id:'m2', label: 'Almond', priceModifier: 0.5 }, { id:'m4', label: 'Oat', priceModifier: 0.5 }] },
      { id: 'toppings', name: 'Add-ins', selectionType: 'checkbox', options: [{ id:'to7', label: 'Vanilla Boost', priceModifier: 0.5 }, { id:'to8', label: 'Cold Foam', priceModifier: 1.00}] },
    ],
    availability: 'available',
  },
   {
    id: 'prod-3', name: 'Classic Croissant', price: 2.50, image: '/src/assets/pastry-icon.png', category: 'Pastry',
    description: 'Buttery and flaky, fresh from the oven.',
    optionCategories: [
        { id: 'temp', name: 'Temperature', selectionType: 'radio', options: [{id:'w1', label:'Warm'}, {id:'w2', label:'Room Temp'}] }
    ],
    availability: 'available', tags: ['classic']
  },
   {
    id: 'prod-4', name: 'Strawberry Cheesecake Slice', price: 4.00, image: '/src/assets/dessert-icon.png', category: 'Dessert',
    description: 'Creamy cheesecake topped with fresh strawberries.',
    // No options
    availability: 'limited',
  },
   {
    id: 'prod-5', name: 'Blended Mocha Frappe', price: 6.50, image: '/src/assets/coffee-cup.png', category: 'Coffee',
    description: 'Icy, chocolatey, and caffeinated. A perfect treat.',
    optionCategories: [
        { id: 'size', name: 'Size', selectionType: 'radio', options: [{ id:'s2', label: 'M' }, { id:'s3', label: 'L' }] },
        { id: 'sugarLevel', name: 'Sugar', selectionType: 'radio', options: [{ id:'su2', label: '50%' }, { id:'su3', label: '70%' }, { id:'su4', label: '100%' }] },
        { id: 'milk', name: 'Milk', selectionType: 'radio', options: [{ id:'m1', label: 'Dairy' }, { id:'m2', label: 'Almond', priceModifier: 0.5 }] },
        { id: 'toppings', name: 'Toppings', selectionType: 'checkbox', options: [{ id:'to3', label: 'Syrup', priceModifier: 0.5 }, { id:'to4', label: 'Drizzle', priceModifier: 0.5 }, { id:'to6', label: 'Whipped Cream', priceModifier: 0.75 }] }
    ],
    availability: 'available', tags: ['popular', 'treat']
  },
];

// State for options selected on a *single* product card before adding to cart
interface CardSelectionState {
    [productId: string]: {
        quantity: number;
        // Store selections based on category ID
        selectedOptions: { [categoryId: string]: string | string[] }; 
    };
}

interface MenuPageProps {
  placeNewOrder: (orderData: NewOrderData) => void;
  user: User | null; // Add user prop
}

const Menu: React.FC<MenuPageProps> = ({ placeNewOrder, user }) => {
  const [activeCategory, setActiveCategory] = useState<Product['category'] | 'All'>('All');
  const [currentOrder, setCurrentOrder] = useState<MenuOrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [cardSelections, setCardSelections] = useState<CardSelectionState>({});
  const customerNameInputRef = useRef<HTMLInputElement>(null); // Create a ref for the input

  // Filter products based on active category
  const filteredByCategory = activeCategory === 'All'
    ? sampleProducts
    : sampleProducts.filter(p => p.category === activeCategory);

  const filteredProducts = filteredByCategory.filter(product =>
      product.name.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  // Initialize or get state for a specific product card
  const getCardState = (productId: string, product: Product) => {
      // Initialize selections based on the first option in each category or defaults
      const initialSelectedOptions: { [categoryId: string]: string | string[] } = {};
      product.optionCategories?.forEach(category => {
          if (category.options && category.options.length > 0) {
              if (category.selectionType === 'radio') {
                  initialSelectedOptions[category.id] = category.options[0].label;
              } else { // checkbox
                  initialSelectedOptions[category.id] = []; // Start with nothing selected for checkbox groups
              }
          }
      });

      return cardSelections[productId] || {
          quantity: 1,
          selectedOptions: initialSelectedOptions,
      };
  };

  // Update state for a specific product card
  const updateCardState = (productId: string, updates: Partial<{ quantity: number; selectedOptions: { [categoryId: string]: string | string[] } }>) => {
      const product = sampleProducts.find(p => p.id === productId)!;
      const currentCardState = getCardState(productId, product);
      
      const newSelectedOptions = updates.selectedOptions 
          ? { ...currentCardState.selectedOptions, ...updates.selectedOptions } 
          : currentCardState.selectedOptions;
      
      const newQuantity = updates.quantity !== undefined ? updates.quantity : currentCardState.quantity;

      setCardSelections(prev => ({
          ...prev,
          [productId]: { 
              ...currentCardState, // Spread current state first
              quantity: newQuantity,
              selectedOptions: newSelectedOptions,
           }
      }));
  };

  // Generic handler for option changes (replaces handleToppingChange)
  const handleOptionChange = (productId: string, categoryId: string, selectionType: 'radio' | 'checkbox', optionLabel: string) => {
      const currentCardState = getCardState(productId, sampleProducts.find(p => p.id === productId)!);
      const currentSelection = currentCardState.selectedOptions[categoryId];
      let newSelection: string | string[];

      if (selectionType === 'radio') {
          newSelection = optionLabel;
      } else { // checkbox
          const currentArray = Array.isArray(currentSelection) ? currentSelection : [];
          if (currentArray.includes(optionLabel)) {
              newSelection = currentArray.filter(item => item !== optionLabel); // Deselect
          } else {
              newSelection = [...currentArray, optionLabel]; // Select
          }
      }
      
      updateCardState(productId, { 
          selectedOptions: { [categoryId]: newSelection } 
      });
  };

  // Calculate total price for a MenuOrderItem, including base price and option modifiers
  const calculateItemTotalPrice = (product: Product, quantity: number, selectedOptions: { [categoryId: string]: string | string[] }): number => {
      let price = product.price;
      product.optionCategories?.forEach(category => {
          const selection = selectedOptions[category.id];
          if (selection) {
              const optionsToConsider = Array.isArray(selection) ? selection : [selection];
              optionsToConsider.forEach(selectedLabel => {
                  const chosenOption = category.options.find(opt => opt.label === selectedLabel);
                  if (chosenOption?.priceModifier) {
                      price += chosenOption.priceModifier;
                  }
              });
          }
      });
      return price * quantity;
  };

  // Add item to the current order list
  const handleAddToCart = (product: Product) => {
     const selections = getCardState(product.id, product);
     const calculatedPrice = calculateItemTotalPrice(product, selections.quantity, selections.selectedOptions);

     const newItem: MenuOrderItem = {
         id: product.id,
         name: product.name,
         price: product.price, // Base price
         image: product.image,
         category: product.category,
         description: product.description,
         availability: product.availability,
         tags: product.tags,
         quantity: selections.quantity,
         selectedOptions: selections.selectedOptions,
         itemTotalPrice: calculatedPrice,
     };
     setCurrentOrder(prevOrder => [...prevOrder, newItem]);
     console.log("Added to order:", newItem);
  };

  // Calculate totals (now uses itemTotalPrice from MenuOrderItem)
  const subtotal = currentOrder.reduce((sum, item) => sum + item.itemTotalPrice, 0);
  // SECURITY NOTE: Discount logic remains client-side for UI; server MUST validate.
  const discountPercent = 0.05; 
  const discountAmount = subtotal * discountPercent;
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
   const handleCheckout = () => {
    if (currentOrder.length === 0) {
      alert('Please add items to your order first.'); return;
    }
    if (!customerName.trim()) {
      alert('Please enter a customer name.'); customerNameInputRef.current?.focus(); return;
    }

    const orderToPlace: NewOrderData = {
      customerName: customerName.trim(),
      items: currentOrder.map(item => {
          const customizations: string[] = [];
          const productRef = sampleProducts.find(p => p.id === item.id);
          // Extract customizations from selectedOptions
          productRef?.optionCategories?.forEach(category => {
              const selection = item.selectedOptions[category.id];
              if (selection && (!Array.isArray(selection) || selection.length > 0)) {
                  const selectionString = Array.isArray(selection) ? selection.join(', ') : selection;
                  customizations.push(`${category.name}: ${selectionString}`);
              }
          });

          const placedItem: PlacedOrderItemDetail = {
            name: item.name,
            quantity: item.quantity,
            customizations: customizations,
          };
          return placedItem;
      }),
      totalAmount: total, // Send client-calculated total (backend MUST re-verify)
    };

    placeNewOrder(orderToPlace);
    alert('Order placed successfully!');
    clearFullOrderDetails();
   };

  // Pre-fill customer name if user is customer
  useEffect(() => {
    if (user && user.role === 'customer' && user.name) {
      setCustomerName(user.name);
    }
    // Only run on initial mount or if user changes
  }, [user]);

  return (
    <div className="flex gap-6 h-[calc(100vh-theme(space.24))]"> {/* Adjust height based on layout */}

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

        {/* Category Filters */}
        <div className="flex space-x-2 mb-6">
          {(['All', 'Coffee', 'Pastry', 'Dessert'] as const).map(category => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${
                activeCategory === category
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-stone-200'
              }`}
            >
                {/* Optional: Add icons based on category */}
                {category === 'Coffee' && <img src="/src/assets/coffee-bean.svg" alt="" className="w-4 h-4 opacity-80" />}
                {category === 'Pastry' && <img src="/src/assets/pastry-icon.png" alt="" className="w-4 h-4 opacity-80 rounded-sm" />} 
                {category === 'Dessert' && <img src="/src/assets/dessert-icon.png" alt="" className="w-4 h-4 opacity-80 rounded-sm" />}
                {category}
            </button>
          ))}
        </div>

        {/* Product Grid */}
         <p className="text-sm text-gray-600 mb-4">{filteredProducts.length} products available</p>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 overflow-y-auto pr-2 flex-1"> {/* Make grid scrollable */}
          {filteredProducts.map(product => {
            const cardState = getCardState(product.id, product);
            return (
                <div key={product.id} className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 flex flex-col">
                <img src={product.image} alt={product.name} className="w-24 h-24 object-contain mx-auto mb-3" />
                <h3 className="text-md font-semibold text-gray-800 mb-1 text-center">{product.name}</h3>
                <p className="text-sm text-gray-700 text-center mb-3">${product.price.toFixed(2)}</p>
                
                {/* Interactive Product Options */} 
                <div className="space-y-3 text-xs mb-4 flex-1">
                    {/* Iterate over optionCategories to render options */}
                    {product.optionCategories?.map(category => (
                        <OptionSelector 
                            key={category.id} 
                            productId={product.id} 
                            title={category.name} 
                            options={category.options || []} 
                            selectedValue={cardState.selectedOptions[category.id] || (category.selectionType === 'checkbox' ? [] : '')} 
                            onChange={(value) => handleOptionChange(product.id, category.id, category.selectionType, value)}
                            type={category.selectionType}
                        />
                    ))}
                </div>
                
                {/* Quantity and Add Button */}
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-stone-200">
                     <div className="flex items-center space-x-1">
                        <button onClick={() => updateCardState(product.id, { quantity: Math.max(1, cardState.quantity - 1) })} className="quantity-button">-</button>
                        <span className="font-medium w-6 text-center text-sm text-gray-800">{cardState.quantity}</span>
                        <button onClick={() => updateCardState(product.id, { quantity: cardState.quantity + 1 })} className="quantity-button">+</button>
                     </div>
                     <button 
                        onClick={() => handleAddToCart(product)}
                        className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors">
                        Add to cart
                    </button>
                </div>
                </div>
            );
          })}
          {filteredProducts.length === 0 && (
             <p className="text-gray-500 col-span-full text-center mt-10">No products found{productSearchTerm ? ` matching "${productSearchTerm}"` : ''}.</p>
          )}
        </div>
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
                    // Temporarily return null to isolate syntax error
                    return null; 
                    /* Original return commented out:
                    const productRef = sampleProducts.find(p => p.id === item.id);
                    return (
                      <div key={`${item.id}-${index}`} className="flex items-start gap-3 relative group pr-6">
                          <img src={item.image} alt={item.name} className="w-10 h-10 object-contain bg-stone-50 rounded-md p-1 border border-stone-200"/>
                          <div className="flex-1">
                              <p className="text-sm font-medium text-gray-800">{item.name}</p>
                              <p className="text-xs text-gray-500">(Options display removed for debugging)</p>
                          </div>
                          <div className="text-right">
                             <p className="text-sm font-medium text-gray-800">${item.itemTotalPrice.toFixed(2)}</p>
                             <p className="text-xs text-gray-600">Qty: {item.quantity}</p>
                          </div>
                           <button 
                               onClick={() => handleRemoveFromOrder(index)}
                               title="Remove Item"
                               className="absolute top-1 right-0 p-1 rounded-full text-red-400 hover:bg-red-100 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all duration-150"
                            >
                                <img src="/src/assets/delete.svg" alt="Remove" className="w-3.5 h-3.5" /> 
                           </button>
                      </div>
                    ); 
                    */
                })}
           </div>

          {/* Order Summary */}
          <div className="space-y-1 text-sm mb-4">
              <div className="flex justify-between text-gray-700">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                   <span>Discount ({ (discountPercent * 100).toFixed(0) }%)</span>
                   <span className="text-red-600">-${discountAmount.toFixed(2)}</span>
              </div>
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
    </div>
  );
};

// --- Helper Component for Options --- 
interface OptionSelectorProps {
    productId: string;
    title: string;
    options: ProductOption[];
    selectedValue: string | string[]; 
    onChange: (value: string) => void;
    type: 'radio' | 'checkbox';
    labelColor?: string; 
}

const OptionSelector: React.FC<OptionSelectorProps> = ({ productId, title, options, selectedValue, onChange, type, labelColor = 'text-gray-700' }) => {
    if (!options || options.length === 0) return null;

    const inputName = `${type}-${title.replace(/\s+/g, '').toLowerCase()}-${productId}`;

    return (
        <div>
            <label className={`block text-[11px] font-medium ${labelColor} mb-1`}>{title}</label>
            <div className="flex flex-wrap gap-1.5">
                {options.map(option => {
                    const id = `${inputName}-${option.label.replace(/\s+/g, '')}`;
                    const isSelected = type === 'radio' 
                        ? selectedValue === option.label 
                        : Array.isArray(selectedValue) && selectedValue.includes(option.label);
                    
                    return (
                         <button 
                             key={id}
                             type="button"
                             onClick={() => onChange(option.label)}
                              // Selected state: Emerald bg, white text. Inactive: Stone bg, dark stone text
                             className={`px-2.5 py-1 rounded-md text-[10px] border font-medium transition-colors ${isSelected ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200 hover:border-stone-300'}`}>
                             {option.label}
                         </button>
                     );
                })}
            </div>
        </div>
    );
};

export default Menu; 