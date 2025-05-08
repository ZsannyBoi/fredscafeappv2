import React, { useState, useEffect } from 'react';
// Import shared types
import { Product, ProductOption, OptionCategory } from '../types'; 

// Local Interfaces Removed
// interface ProductOption { ... }
// interface OptionCategory { ... }
// interface Product { ... }

// Sample data (Updated IDs to string, ensure structure matches imported Product)
const initialSampleProducts: Product[] = [
    { 
        id: 'prod-1', name: 'Hot Caramel Macchiato', price: 5.99, image: '/src/assets/coffee-cup.png', category: 'Coffee', 
        optionCategories: [
            { id: 'size', name: 'Size', selectionType: 'radio', options: [{id: 's1', label: 'S' }, {id: 's2', label: 'M' }, {id: 's3', label: 'L' }] },
            { id: 'sugarLevel', name: 'Sugar Level', selectionType: 'radio', options: [{id: 'su1', label: '30%' }, {id: 'su2', label: '50%' }, {id: 'su3', label: '70%' }, {id: 'su4', label: '100%' }] },
            { id: 'temperature', name: 'Temperature', selectionType: 'radio', options: [{id: 't1', label: 'Hot' }] }, // Removed Iced/Blend for Hot Macchiato
            // Assuming OptionCategory now includes selectionType
            { id: 'toppings', name: 'Toppings', selectionType: 'checkbox', options: [{id: 'to1', label: 'N/A' }, {id: 'to3', label: 'Syrup' }, {id: 'to4', label: 'Drizzle' }] }
        ]
    },
    { 
        id: 'prod-2', name: 'Iced Vanilla Latte', price: 4.99, image: '/src/assets/coffee-cup.png', category: 'Coffee', 
        optionCategories: [
             { id: 'size', name: 'Size', selectionType: 'radio', options: [{id: 's2', label: 'M' }, {id: 's3', label: 'L' }] }, // Removed S
             { id: 'sugarLevel', name: 'Sugar Level', selectionType: 'radio', options: [{id: 'su1', label: '30%' }, {id: 'su2', label: '50%' }, {id: 'su3', label: '70%' }, {id: 'su4', label: '100%' }] },
             // Removed Temperature for Iced Latte (implicit)
             { id: 'toppings', name: 'Toppings', selectionType: 'checkbox', options: [{id: 'to1', label: 'N/A' }, {id: 'to3', label: 'Syrup' }, {id: 'to4', label: 'Drizzle' }] }
        ]
    },
    { id: 'prod-3', name: 'Croissant', price: 2.50, image: '/src/assets/pastry-icon.png', category: 'Pastry', optionCategories: [] }, // No options
    { id: 'prod-4', name: 'Cheesecake Slice', price: 4.00, image: '/src/assets/dessert-icon.png', category: 'Dessert', optionCategories: [] }, // No options
    { 
        id: 'prod-5', name: 'Blended Mocha Frappe', price: 6.50, image: '/src/assets/coffee-cup.png', category: 'Coffee', 
        optionCategories: [
             { id: 'size', name: 'Size', selectionType: 'radio', options: [{id: 's2', label: 'M' }, {id: 's3', label: 'L' }] },
             { id: 'sugarLevel', name: 'Sugar Level', selectionType: 'radio', options: [{id: 'su2', label: '50%' }, {id: 'su3', label: '70%' }, {id: 'su4', label: '100%' }] },
             // Removed Temperature for Blended (implicit)
             { id: 'toppings', name: 'Toppings', selectionType: 'checkbox', options: [{id: 'to3', label: 'Syrup' }, {id: 'to4', label: 'Drizzle' }, {id: 'to6', label: 'Whipped Cream' }] }
        ]
    },
];

// Product Form State Interface (Uses imported OptionCategory)
interface ProductFormData {
    productType: string; 
    name: string;
    price: string; 
    image: File | null; 
    imagePreviewUrl?: string; 
    optionCategories: OptionCategory[]; 
}

// Default empty form state (Uses imported OptionCategory)
const defaultFormState: ProductFormData = {
    productType: '', 
    name: '',
    price: '',
    image: null,
    imagePreviewUrl: undefined,
    optionCategories: [], 
};

const EditMenu: React.FC = () => {
  // State for the list of products (Uses imported Product)
  const [products, setProducts] = useState<Product[]>(initialSampleProducts);
  
  // State for dynamic categories
  const [availableCategories, setAvailableCategories] = useState<string[]>(['Coffee', 'Pastry', 'Dessert']);
  // Active category is now a string, default to first available or empty
  const [activeCategory, setActiveCategory] = useState<string>(availableCategories[0] || '');
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null); // Track selected product for editing
  const [formData, setFormData] = useState<ProductFormData>(defaultFormState);
  const [isAdding, setIsAdding] = useState(false); // State to show/hide form

  // State for temporary inputs (adding new category/option)
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newOptionValues, setNewOptionValues] = useState<{ [categoryId: string]: string }>({}); // Store new option input per category
  const [editingCategoryName, setEditingCategoryName] = useState<{ [categoryId: string]: string }>({}); // Store edits per category
  const [editingOptionLabel, setEditingOptionLabel] = useState<{ [optionId: string]: string }>({}); // Store edits per option

  // State for adding new category
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  // Initialize form productType with activeCategory when component loads or categories change
  useEffect(() => {
    if (!formData.productType && availableCategories.length > 0) {
      setFormData(prev => ({ ...prev, productType: activeCategory || availableCategories[0] }));
    } else if (formData.productType && !availableCategories.includes(formData.productType)) {
        // If current form type is no longer valid, reset to active/first
        setFormData(prev => ({ ...prev, productType: activeCategory || availableCategories[0] || '' }));
    }
  }, [activeCategory, availableCategories]); // Rerun when categories change

  // Filter products based on active category (Uses imported Product)
  const filteredProducts = products.filter(p => p.category === activeCategory);

  // Handle selecting a product to edit (Uses imported Product, OptionCategory)
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsAdding(false); 
    // Deep copy optionCategories only if they exist
    const copiedOptionCategories = product.optionCategories ? product.optionCategories.map(cat => ({ 
        ...cat, 
        options: [...cat.options] 
    })) : [];
    setFormData({
        productType: product.category,
        name: product.name,
        price: product.price.toString(),
        image: null, 
        imagePreviewUrl: product.image, 
        optionCategories: copiedOptionCategories,
    });
     console.log("Selected Product:", product);
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle image change
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files ? e.target.files[0] : null;
      setFormData(prev => ({
          ...prev,
          image: file,
          imagePreviewUrl: file ? URL.createObjectURL(file) : (selectedProduct?.image || '/src/assets/placeholder-image.png')
      }));
  };

  // Clean up object URL when component unmounts or preview changes
  useEffect(() => {
      return () => {
          if (formData.imagePreviewUrl && formData.imagePreviewUrl.startsWith('blob:')) {
              URL.revokeObjectURL(formData.imagePreviewUrl);
          }
      };
  }, [formData.imagePreviewUrl]);

  // Add a new option category to the form data (Uses imported OptionCategory, ProductOption)
  const addOptionCategory = () => {
      if (!newCategoryName.trim()) return;
      // Need to specify selectionType when adding a new category
      const newCat: OptionCategory = { 
          id: `cat-${Date.now()}`, 
          name: newCategoryName.trim(), 
          selectionType: 'radio', // Default to radio, maybe add UI to select this?
          options: [] 
      };
      setFormData(prev => ({ 
          ...prev, 
          optionCategories: [...prev.optionCategories, newCat]
      }));
      setNewCategoryName('');
  };

  // Remove an option category (Uses imported OptionCategory)
  const removeOptionCategory = (categoryId: string) => {
      setFormData(prev => ({
          ...prev,
          optionCategories: prev.optionCategories.filter(cat => cat.id !== categoryId)
      }));
  };

  // Update the name of an option category in the form data
  const updateOptionCategoryName = (categoryId: string, newName: string) => {
      if (!newName.trim()) return; // Prevent empty names
      setFormData(prev => ({
          ...prev,
          optionCategories: prev.optionCategories.map(cat => 
              cat.id === categoryId ? { ...cat, name: newName.trim() } : cat
          )
      }));
  };

  // Add a new option value to a specific category in the form data
  const addOptionValue = (categoryId: string) => {
      const label = newOptionValues[categoryId];
      if (!label || !label.trim()) return;
      // Generate ID here if needed for form management, or rely on saving to backend
      const newOpt: ProductOption = { id: `opt-${Date.now()}`, label: label.trim() }; 
      setFormData(prev => ({
          ...prev,
          optionCategories: prev.optionCategories.map(cat => 
              cat.id === categoryId 
                  ? { ...cat, options: [...cat.options, newOpt] } 
                  : cat
          )
      }));
      handleNewOptionValueChange(categoryId, '');
  };

  // Remove an option value from a specific category by its ID
  const removeOptionValue = (categoryId: string, optionId: string | undefined) => {
      if (!optionId) {
          console.warn("Attempted to remove option without an ID");
          return; 
      }
      setFormData(prev => ({
          ...prev,
          optionCategories: prev.optionCategories.map(cat => 
              cat.id === categoryId 
                  ? { ...cat, options: cat.options.filter(opt => opt.id !== optionId) } 
                  : cat
          )
      }));
  };

  // Update the label of an option value within a category
  const updateOptionValueLabel = (categoryId: string, optionId: string | undefined, newLabel: string) => {
       if (!newLabel.trim() || !optionId) { 
           console.warn("Attempted to update option label without ID or new label");
           return;
       }
       setFormData(prev => ({
          ...prev,
          optionCategories: prev.optionCategories.map(cat => 
              cat.id === categoryId 
                  ? { ...cat, options: cat.options.map(opt => opt.id === optionId ? { ...opt, label: newLabel.trim() } : opt) } 
                  : cat
          )
       }));
  };

  // Placeholder for form submission
  const handleSave = (e: React.FormEvent) => {
      e.preventDefault();
      console.log("Saving data:", formData);
      
      const productData: Omit<Product, 'id'> = {
          name: formData.name.trim(),
          price: parseFloat(formData.price) || 0,
          category: formData.productType.trim(),
          image: formData.imagePreviewUrl || '/src/assets/placeholder-image.png',
          optionCategories: formData.optionCategories.length > 0 ? formData.optionCategories : undefined,
      };

      if (isAdding) {
          const newProduct: Product = {
              ...productData,
              id: `prod-${Date.now().toString()}`, // Use string ID
          };
          console.log("Adding product:", newProduct);
          setProducts(prev => [newProduct, ...prev]);
          setActiveCategory(newProduct.category);
          handleSelectProduct(newProduct);
          setIsAdding(false); 
      } else if (selectedProduct) {
          const updatedProduct: Product = {
              ...productData,
              id: selectedProduct.id, 
          };
          console.log("Updating product:", updatedProduct);
          setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
          setSelectedProduct(updatedProduct);
      } else {
        console.error("Save attempted without a selected product or adding state.");
      }
  };

  // Placeholder for canceling edit/add
  const handleCancel = () => {
      setSelectedProduct(null);
      setIsAdding(false);
      setFormData(defaultFormState); // Reset form completely
      setNewCategoryName('');
      setNewOptionValues({});
      setEditingCategoryName({});
      setEditingOptionLabel({});
  };

  // Handle starting to add a new product
  const handleAddProductClick = () => {
      setSelectedProduct(null);
      setIsAdding(true);
      setFormData(defaultFormState); // Start with empty form
  };

  // Preview data based on selected product or form state
  const previewData = selectedProduct || { 
      name: formData.name || 'Product Name', 
      price: parseFloat(formData.price) || 0.00, 
      image: formData.imagePreviewUrl || '/src/assets/placeholder-image.png',
      optionCategories: formData.optionCategories,
      category: formData.productType,
      id: -1 // Indicate preview/new product
  };

  // Helper functions for dynamic option management
  const handleNewOptionValueChange = (categoryId: string, value: string) => {
      setNewOptionValues(prev => ({ ...prev, [categoryId]: value }));
  };

  const startEditCategoryName = (category: OptionCategory) => {
      setEditingCategoryName(prev => ({ ...prev, [category.id]: category.name }));
  };

  const cancelEditCategoryName = (categoryId: string) => {
      setEditingCategoryName(prev => {
          const newState = { ...prev };
          delete newState[categoryId];
          return newState;
      });
  };

  const saveEditCategoryName = (categoryId: string) => {
      const newName = editingCategoryName[categoryId];
      if (newName !== undefined) {
          updateOptionCategoryName(categoryId, newName);
          cancelEditCategoryName(categoryId); // Exit edit mode
      }
  };

  const startEditOptionLabel = (option: ProductOption) => {
      if (!option.id) return; // Cannot edit if no ID
      setEditingOptionLabel(prev => ({ ...prev, [option.id!]: option.label })); // Use non-null assertion or check
  };

  const cancelEditOptionLabel = (optionId: string | undefined) => {
      if (!optionId) return;
      setEditingOptionLabel(prev => {
          const newState = { ...prev };
          delete newState[optionId];
          return newState;
      });
  };

  const saveEditOptionLabel = (categoryId: string, optionId: string | undefined) => {
      if (!optionId) return;
      const newLabel = editingOptionLabel[optionId];
      if (newLabel !== undefined) {
          updateOptionValueLabel(categoryId, optionId, newLabel);
          cancelEditOptionLabel(optionId); 
      }
  };
  
  const handleEditOptionLabelChange = (optionId: string | undefined, value: string) => {
      if (!optionId) return; // Guard against undefined ID
      // Ensure we only update state if optionId is a valid key
      setEditingOptionLabel(prev => ({ ...prev, [optionId]: value }));
  };

  // Handle adding a new category
  const handleAddCategory = () => {
      if (!newCategoryInput.trim()) return;
      setAvailableCategories(prev => [...prev, newCategoryInput.trim()]);
      setNewCategoryInput('');
      setIsAddingCategory(false);
  };

  const handleDeleteCategory = (categoryToDelete: string) => {
      // 1. Check if any products are using this category
       const productsInCategory = products.filter(p => p.category === categoryToDelete);
       
       // 2. Confirmation dialog
       let confirmDelete = true; // Assume deletion is okay if no products
       if (productsInCategory.length > 0) {
           confirmDelete = window.confirm(
              `Category "${categoryToDelete}" contains ${productsInCategory.length} product(s). Deleting the category will NOT delete the products, but they might become inaccessible or need recategorization later.\n\nAre you sure you want to delete this category?`
           );
       }
        // Optional: Prevent deleting the last category
        if (availableCategories.length <= 1) {
            alert("Cannot delete the last category.");
            return;
        }

       if (confirmDelete) {
           // 3. Update availableCategories state
           setAvailableCategories(prev => prev.filter(cat => cat !== categoryToDelete));

           // 4. Update activeCategory if the deleted one was active
           if (activeCategory === categoryToDelete) {
                // Activate the first remaining category, or empty if none left
                const remainingCategories = availableCategories.filter(cat => cat !== categoryToDelete);
                setActiveCategory(remainingCategories[0] || '');
            }

            // 5. Reset product selection/form
            handleCancel(); 

            console.log(`Deleted category: ${categoryToDelete}`);
       }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-theme(space.24))]">
      {/* Main Content Area - Product List */}
      <div className="flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-semibold text-brown-900">Edit Menu</h1>
               <div className="flex space-x-3">
            <button
                        onClick={handleAddProductClick}
                        className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-green-700 transition-colors">
                        <img src="/src/assets/add.svg" alt="" className="w-4 h-4" />
                        Add a product
            </button>
          </div>
        </div>

        {/* Category Filters - Now dynamic */}
        <div className="flex space-x-2 mb-6 items-center flex-wrap">
           {availableCategories.map(category => (
          <button
                key={category}
                 onClick={() => {
                    setActiveCategory(category);
                    handleCancel(); // Reset selection/form on category change
                 }}
                 className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors mb-2 ${ 
                    activeCategory === category
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-stone-200'
                 }`}
             >
               {/* Basic display for now, icons could be mapped later */}
               {category}
               {/* Delete Category Button */} 
               {!isAddingCategory && availableCategories.length > 1 && ( // Show only when not adding and more than 1 cat exists
          <button
                       onClick={(e) => { 
                           e.stopPropagation(); // Prevent category selection
                           handleDeleteCategory(category);
                       }}
                       title={`Delete category "${category}"`}
                       className="ml-1.5 p-0.5 rounded-full text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
          </button>
               )}
          </button>
           ))}
           
           {/* Add Category UI Toggle */} 
           {!isAddingCategory ? (
          <button
                   onClick={() => setIsAddingCategory(true)} 
                   className="ml-2 text-emerald-600 hover:text-emerald-800 text-sm font-medium mb-2 p-2 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors">
                   + Add Category
          </button>
           ) : (
                <div className="flex items-center space-x-2 mb-2 ml-2 p-2 border border-emerald-200 rounded-lg bg-emerald-50/50">
                    <input 
                        type="text"
                         placeholder="New category name..."
                         value={newCategoryInput}
                         onChange={(e) => setNewCategoryInput(e.target.value)}
                         onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') { setIsAddingCategory(false); setNewCategoryInput(''); } }}
                         className="form-input px-2 py-1 text-sm w-36"
                         autoFocus
                     />
                     <button onClick={handleAddCategory} className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700">Save</button>
                     <button onClick={() => { setIsAddingCategory(false); setNewCategoryInput(''); }} className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300">Cancel</button>
                </div>
           )}
        </div>

        {/* Product Grid */}
        <p className="text-sm text-gray-600 mb-4">
            {activeCategory 
                ? `${filteredProducts.length} products available in ${activeCategory}`
                : 'Select a category'
            }
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 overflow-y-auto pr-2 flex-1">
          {filteredProducts.map(product => (
            <div
              key={product.id} 
              onClick={() => handleSelectProduct(product)}
              className={`bg-white rounded-2xl p-4 shadow border hover:shadow-md transition-shadow cursor-pointer ${selectedProduct?.id === product.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-100'}`}>
                {/* Simplified Product Card for selection */}
                <img src={product.image} alt={product.name} className="w-20 h-20 object-contain mx-auto mb-2" />
                <h3 className="text-md font-semibold text-brown-900 mb-1 text-center">{product.name}</h3>
                <p className="text-sm text-gray-700 text-center mb-2">${product.price.toFixed(2)}</p>
                {/* Add edit/delete icons if needed directly on card */}
            </div>
          ))}
           {filteredProducts.length === 0 && (
             <p className="text-gray-500 col-span-full text-center mt-10">No products found in this category.</p>
          )}
        </div>
      </div>

      {/* Right Sidebar - Product Preview & Edit Form */}
      <div className="w-96 bg-white rounded-2xl p-5 shadow flex flex-col border border-gray-100 h-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-brown-800">{isAdding ? 'Add New Product' : selectedProduct ? 'Edit Product' : 'Product Details'}</h2>
             {selectedProduct && !isAdding && (
                  <button 
                     onClick={() => {
                         if (window.confirm(`Are you sure you want to delete ${selectedProduct.name}?`)) {
                              console.log("Deleting product:", selectedProduct.id);
                              // TODO: Implement API call to delete from backend
                              setProducts(prev => prev.filter(p => p.id !== selectedProduct.id));
                              handleCancel(); // Clear selection and form
                         }
                     }}
                     title="Delete Product"
                     className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200 transition-colors">
                     <img src="/src/assets/delete.svg" alt="Delete" className="w-4 h-4" />
                  </button>
             )}
          </div>

          {/* Product Preview Section */} 
          {selectedProduct && !isAdding && (
              <div className={`bg-gray-50 rounded-xl p-4 mb-5 border border-gray-200`}>
                    <h3 className="text-sm font-medium text-gray-500 mb-3">Preview</h3>
                     <div className="flex items-start gap-3">
                          <img 
                             src={selectedProduct.image} 
                             alt={selectedProduct.name} 
                             className="w-16 h-16 object-contain bg-white rounded-md p-1 border border-gray-200"/>
                          <div className="flex-1">
                             <p className="text-md font-semibold text-gray-800">{selectedProduct.name}</p>
                             <p className="text-sm font-medium text-green-600 mb-2">${selectedProduct.price.toFixed(2)}</p>
                              {/* Loop through selectedProduct.optionCategories */} 
                              {selectedProduct.optionCategories && selectedProduct.optionCategories.length > 0 ? (
                                selectedProduct.optionCategories.map(cat => (
                                  <p key={cat.id} className="text-xs text-gray-500">
                                      <span className="font-medium">{cat.name}:</span> {cat.options.map(o => o.label).join(', ') || 'N/A'}
                                  </p>
                                ))
                              ) : (
                                <p className="text-xs text-gray-500">No options defined.</p>
                              )}
                </div>
              </div>
              </div>
          )}

         {/* Edit/Add Form Section */}
          {(selectedProduct || isAdding) && (
              <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
                 <h3 className="text-md font-semibold text-brown-800 mb-3">{isAdding ? 'Enter details' : 'Edit details'}</h3>
                 <p className="text-xs text-gray-400 text-right mb-2">#012706</p> { /* Placeholder ID? */}
                 
                  <div className="space-y-4 overflow-y-auto pr-2 flex-1 mb-4"> { /* Make form scrollable */}
                     {/* Product Type - Now dynamic */}
                     <div className="mb-3">
                         <label className="block text-sm font-medium text-gray-700 mb-1">Product Type</label>
                         <div className="flex flex-wrap gap-2">
                            {availableCategories.map(type => (
                                 <button 
                                     key={type}
                                     type="button" // Prevent form submission
                                     onClick={() => setFormData(prev => ({...prev, productType: type}))}
                                     className={`px-3 py-1.5 rounded-lg text-xs border font-medium transition-colors ${ 
                                        formData.productType === type
                                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                            : 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200 hover:border-stone-300'
                                     }`}
                                 >
                                     {type}
                                 </button>
                             ))}
                             {availableCategories.length === 0 && <p className="text-xs text-gray-500">No categories available. Add one first.</p>} 
        </div>
      </div>

              <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Enter product name</label>
                        <input type="text" name="name" id="name" value={formData.name} onChange={handleInputChange} required className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brown-400 text-sm" />
              </div>
              <div>
                        <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                        <input type="number" name="price" id="price" value={formData.price} onChange={handleInputChange} required step="0.01" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brown-400 text-sm" />
                    </div>

                    {/* Image Upload Placeholder */}
                    <div>
                        <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
                        <input type="file" name="image" id="image" accept="image/*" onChange={handleImageChange} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                         {/* Show image preview */} 
                         {formData.imagePreviewUrl && (
                            <img src={formData.imagePreviewUrl} alt="Preview" className="mt-2 h-20 w-20 object-contain border rounded bg-gray-50 p-1" />
                         )}
                    </div>

                    {/* Dynamic Options UI */}
                    <div className="border-t border-gray-200 pt-4 mt-4">
                        <h4 className="text-lg font-semibold text-brown-800 mb-3">Product Options</h4>
                        
                        {/* Display and Edit Existing Categories/Options */} 
                        <div className="space-y-4">
                            {formData.optionCategories.map((category) => (
                              <div key={category.id} className="p-3 border border-gray-200 rounded-lg bg-gray-50/50">
                                  {/* Category Name (View/Edit) */} 
                                  <div className="flex justify-between items-center mb-2">
                                      {editingCategoryName.hasOwnProperty(category.id) ? (
                                          <input 
                                              type="text" 
                                              value={editingCategoryName[category.id]}
                                              onChange={(e) => setEditingCategoryName(prev => ({...prev, [category.id]: e.target.value}))}
                                              onBlur={() => saveEditCategoryName(category.id)} // Save on blur
                                              onKeyDown={(e) => { if (e.key === 'Enter') saveEditCategoryName(category.id); if (e.key === 'Escape') cancelEditCategoryName(category.id); }}
                                              className="form-input text-sm font-medium p-1 flex-1 mr-2"
                                              autoFocus
                                          />
                                      ) : (
                                          <span className="text-sm font-medium text-brown-800 cursor-pointer" onClick={() => startEditCategoryName(category)}>{category.name}</span>
                                      )}
                                      <button type="button" onClick={() => removeOptionCategory(category.id)} className="text-red-500 hover:text-red-700 text-xs ml-2">Remove</button>
                                  </div>

                                  {/* Options within Category */} 
                                  <div className="space-y-1 pl-2 border-l border-gray-300 ml-1">
                                      {category.options.map((option) => (
                                          <div key={option.id || `temp-${option.label}`} className="flex items-center justify-between text-xs group">
                                              {/* Option Label Edit - Handle optional ID */}
                                              {option.id && editingOptionLabel[option.id] !== undefined ? (
                                                 <input 
                                                     type="text" 
                                                     value={editingOptionLabel[option.id]} // ID is checked, safe to use as key
                                                     onChange={(e) => handleEditOptionLabelChange(option.id, e.target.value)} // ID is checked, safe to pass
                                                     onBlur={() => saveEditOptionLabel(category.id, option.id)}
                                                     onKeyDown={(e) => e.key === 'Enter' && saveEditOptionLabel(category.id, option.id)}
                                                     className="form-input py-0.5 text-xs" autoFocus
                                                 />
                                              ) : (
                                                  <span onDoubleClick={() => option.id && startEditOptionLabel(option)}>{option.label}</span>
                                              )}
                                              {/* Remove Button - Check option.id */}
                                              <button 
                                                  type="button" 
                                                  onClick={() => option.id && removeOptionValue(category.id, option.id)} 
                                                  disabled={!option.id} 
                                                  className="text-red-400 hover:text-red-600 text-[10px] opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:pointer-events-none"
                                              >
                                                 Remove
                                              </button>
                                          </div>
                                      ))}
                                       {/* Add New Option Value Input */} 
                                       <div className="flex items-center mt-1">
                <input
                  type="text"
                                               placeholder="Add option value..." 
                                               value={newOptionValues[category.id] || ''}
                                               onChange={(e) => handleNewOptionValueChange(category.id, e.target.value)}
                                               onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOptionValue(category.id); } }}
                                               className="form-input p-0.5 text-xs flex-1 mr-1"
                                           />
                                            <button type="button" onClick={() => addOptionValue(category.id)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Add</button>
                                        </div>
                                   </div>
                               </div>
                             ))}
              </div>

                         {/* Add New Option Category */} 
                         <div className="mt-4 pt-3 border-t border-gray-200">
                             <label className="block text-sm font-medium text-gray-700 mb-1">Add New Option Category</label>
                             <div className="flex items-center">
                                 <input 
                                   type="text" 
                                   placeholder="E.g., Milk Type, Syrup Flavor" 
                                   value={newCategoryName}
                                   onChange={(e) => setNewCategoryName(e.target.value)}
                                   onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOptionCategory(); } }}
                                   className="form-input flex-1 mr-2"
                                 />
                                 <button type="button" onClick={addOptionCategory} className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-300">
                                     Add Category
                </button>
              </div>
            </div>
          </div>
                 </div>

                 {/* Form Actions */}
                 <div className="flex space-x-3 mt-auto pt-4 border-t border-gray-100">
                   <button type="button" onClick={handleCancel} className="form-cancel-button">
                       Cancel
                   </button>
                   <button type="submit" className="form-save-button">
                       {isAdding ? 'Add Product' : 'Save Changes'}
                   </button>
                 </div>
             </form>
          )}

          {/* Placeholder when nothing is selected and not adding */}
           {!selectedProduct && !isAdding && (
               <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400">
                 <img src="/src/assets/edit-menu.svg" alt="" className="w-16 h-16 mb-4 opacity-50" />
                 <p>Select a product from the left to preview or edit its details.</p>
                 <p className="mt-2">Or click 'Add a product' to create a new one.</p>
        </div>
      )}

      </div>
    </div>
  );
};

export default EditMenu; 