import React, { useState, useEffect, useRef } from 'react';
// Import shared types
import { Product, ProductOption, OptionCategory, BackendOptionGroup } from '../types'; 

// Interface for the category data fetched from the backend
interface FetchedCategory {
  category_id: number;
  name: string;
  image_url: string | null;
}

// Local Interfaces Removed
// interface ProductOption { ... }
// interface OptionCategory { ... }
// interface Product { ... }

// Product Form State Interface (Uses imported OptionCategory)
interface ProductFormData {
    categoryId: number | null; // Ensure this replaces productType
    name: string;
    price: string; 
    image: File | null; 
    imagePreviewUrl?: string; 
    description?: string; // Added description
    optionCategories: OptionCategory[]; 
}

// Default empty form state (Uses imported OptionCategory)
const defaultFormState: ProductFormData = {
    categoryId: null, // Ensure this is set
    name: '',
    price: '',
    image: null,
    imagePreviewUrl: '/src/assets/product.png',
    description: '', // Initialize description
    optionCategories: [], 
};

const EditMenu: React.FC = () => {
  // Product State
  const [products, setProducts] = useState<Product[]>([]); // Initialize empty
  const [productsLoading, setProductsLoading] = useState<boolean>(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  
  // State for the list of products (Uses imported Product)
  const [initialSampleProducts, setInitialSampleProducts] = useState<Product[]>([]);
  
  // State for dynamic categories (Will be replaced)
  const [availableCategories, setAvailableCategories] = useState<string[]>(['Coffee', 'Pastry', 'Dessert']);
  // Active category is now a string, default to first available or empty (Will be replaced)
  const [activeCategory, setActiveCategory] = useState<string>(availableCategories[0] || '');
  
  // --- New State for Backend Categories ---
  const [fetchedCategories, setFetchedCategories] = useState<FetchedCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState<boolean>(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  // Use activeCategoryId for filtering logic
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null); 
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null); // Track selected product for editing
  const [selectedProductOptionsLoading, setSelectedProductOptionsLoading] = useState<boolean>(false);
  const [selectedProductOptionsError, setSelectedProductOptionsError] = useState<string | null>(null);
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
  const [newCategoryImageFile, setNewCategoryImageFile] = useState<File | null>(null);
  const [newCategoryImagePreviewUrl, setNewCategoryImagePreviewUrl] = useState<string | undefined>(undefined);
  const categoryImageInputRef = useRef<HTMLInputElement>(null);

  // --- New State for Backend Option Groups ---
  const [optionGroups, setOptionGroups] = useState<BackendOptionGroup[]>([]);
  const [optionGroupsLoading, setOptionGroupsLoading] = useState<boolean>(true);
  const [optionGroupsError, setOptionGroupsError] = useState<string | null>(null);
  const [newOptionGroupName, setNewOptionGroupName] = useState('');
  const [newOptionGroupSelectionType, setNewOptionGroupSelectionType] = useState<'radio' | 'checkbox'>('radio');
  const [newOptionGroupIsRequired, setNewOptionGroupIsRequired] = useState<boolean>(false);
  const [isAddingOptionGroup, setIsAddingOptionGroup] = useState<boolean>(false);
  // State for inline editing of an option group
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editOptionGroupName, setEditOptionGroupName] = useState('');
  const [editOptionGroupSelectionType, setEditOptionGroupSelectionType] = useState<'radio' | 'checkbox'>('radio');
  const [editOptionGroupIsRequired, setEditOptionGroupIsRequired] = useState<boolean>(false);

  // --- New state for managing options within a selected group ---
  const [selectedOptionGroupForOptions, setSelectedOptionGroupForOptions] = useState<BackendOptionGroup | null>(null);
  const [optionsForSelectedGroup, setOptionsForSelectedGroup] = useState<ProductOption[]>([]); // Using ProductOption as it fits label/priceModifier
  const [optionsLoading, setOptionsLoading] = useState<boolean>(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  // State for adding/editing an individual option
  const [isAddingOption, setIsAddingOption] = useState<boolean>(false);
  const [editingOption, setEditingOption] = useState<ProductOption | null>(null);
  const [optionFormLabel, setOptionFormLabel] = useState('');
  const [optionFormPriceModifier, setOptionFormPriceModifier] = useState('');

  // Initialize form productType with activeCategory when component loads or categories change
  useEffect(() => {
    if (!formData.categoryId && fetchedCategories.length > 0) {
      setFormData(prev => ({ ...prev, categoryId: fetchedCategories[0].category_id }));
    } else if (formData.categoryId && !fetchedCategories.some(cat => cat.category_id === formData.categoryId)) {
        // If current form type is no longer valid, reset to active/first
        setFormData(prev => ({ ...prev, categoryId: fetchedCategories[0].category_id }));
    }
  }, [fetchedCategories]); // Rerun when categories change

  // Filter products based on the selected category ID
  const filteredProducts = activeCategoryId === null
    ? products // Show all if no category is selected (or handle as needed)
    : products.filter(p => { 
        // Need to map product category name back to ID for filtering
        const productCategoryId = fetchedCategories.find(cat => cat.name === p.category)?.category_id;
        return productCategoryId === activeCategoryId; 
      });

  // Handle selecting a product to edit (Uses imported Product, OptionCategory)
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsAdding(false); 
    const copiedOptionCategories = product.optionCategories ? product.optionCategories.map(cat => ({ 
        ...cat, 
        options: [...cat.options] 
    })) : [];
    // Find the category ID based on the product's category name
    const selectedCategoryId = fetchedCategories.find(cat => cat.name === product.category)?.category_id || null;
    setFormData({
        categoryId: selectedCategoryId, // Correctly assign the found ID
        name: product.name,
        price: product.price.toString(),
        image: null, 
        imagePreviewUrl: product.image || '/src/assets/product.png', 
        description: product.description,
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
          imagePreviewUrl: file ? URL.createObjectURL(file) : (selectedProduct?.image || '/src/assets/product.png')
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

  // Clean up category image object URL
  useEffect(() => {
    return () => {
      if (newCategoryImagePreviewUrl && newCategoryImagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(newCategoryImagePreviewUrl);
      }
    };
  }, [newCategoryImagePreviewUrl]);

  // --- Fetch Categories from Backend --- 
  useEffect(() => {
    const fetchCategories = async () => {
      setCategoriesLoading(true);
      setCategoriesError(null);
      try {
        const token = localStorage.getItem('authToken'); // Get token
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        // Ensure your backend server is running on port 3001
        const response = await fetch('http://localhost:3001/api/categories', {
          headers: headers, // Add headers
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: FetchedCategory[] = await response.json();
        setFetchedCategories(data);
        // Set initial active category ID after fetching
        if (data && data.length > 0 && activeCategoryId === null) { // Check if activeCategoryId is still null
           setActiveCategoryId(data[0].category_id);
        } else if (data && data.length === 0) {
           setActiveCategoryId(null); // No categories, set to null
        }
      } catch (error: any) {
        console.error("Failed to fetch categories:", error);
        setCategoriesError(`Failed to load categories: ${error.message}`);
      } finally {
        setCategoriesLoading(false);
      }
    };

    fetchCategories();
  }, []); // Empty dependency array means this runs once on mount

  // --- Fetch Option Groups from Backend ---
  useEffect(() => {
    const fetchOptionGroups = async () => {
      setOptionGroupsLoading(true);
      setOptionGroupsError(null);
      try {
        const token = localStorage.getItem('authToken'); // Get token
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const response = await fetch('http://localhost:3001/api/option-groups', {
          headers: headers, // Add headers
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: BackendOptionGroup[] = await response.json();
        setOptionGroups(data);
      } catch (error: any) {
        console.error("Failed to fetch option groups:", error);
        setOptionGroupsError(`Failed to load option groups: ${error.message}`);
      } finally {
        setOptionGroupsLoading(false);
      }
    };
    fetchOptionGroups();
  }, []);

  // --- Fetch Products from Backend --- 
  useEffect(() => {
    const fetchProducts = async () => {
      setProductsLoading(true);
      setProductsError(null);
      try {
        const token = localStorage.getItem('authToken'); // Get token
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const response = await fetch('http://localhost:3001/api/products', {
          headers: headers, // Add headers
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // Map fetched data (snake_case keys from DB) to frontend Product type
        const mappedProducts: Product[] = data.map((p: any) => ({
          id: p.product_id,
          name: p.name,
          price: parseFloat(p.base_price),
          image: p.image_url || '/src/assets/product.png',
          category: p.category_name, // Use category_name from JOIN
          description: p.description,
          // TODO: Fetch and map OptionCategories separately if needed
          optionCategories: [], // Placeholder - needs separate fetch/mapping
          availability: p.availability,
          tags: p.tags ? p.tags.split(',') : [],
        }));
        setProducts(mappedProducts);
      } catch (error: any) {
        console.error("Failed to fetch products:", error);
        setProductsError(`Failed to load products: ${error.message}`);
      } finally {
        setProductsLoading(false);
      }
    };

    fetchProducts();
  }, []); // Fetch products on mount

  // --- Fetch Options for Selected Product ---
  useEffect(() => {
    const fetchOptions = async () => {
      if (!selectedProduct) return; // Only fetch if a product is selected

      setSelectedProductOptionsLoading(true);
      setSelectedProductOptionsError(null);
      setFormData(prev => ({ ...prev, optionCategories: [] })); // Clear previous options

      try {
        const token = localStorage.getItem('authToken'); // Get token
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const response = await fetch(`http://localhost:3001/api/products/${selectedProduct.id}/options`, {
          headers: headers, // Add headers
        });
        if (!response.ok) {
          // Handle case where product might have no options (404 is ok, others are errors)
          if (response.status === 404) {
             console.log(`No options found for product ${selectedProduct.id}`);
             // No error, just no options
             setFormData(prev => ({ ...prev, optionCategories: [] })); 
             return; 
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const optionsData: OptionCategory[] = await response.json();
        
        // Ensure IDs are strings if needed by frontend types (DB returns numbers)
        const mappedOptionsData = optionsData.map(cat => ({
            ...cat,
            id: String(cat.id),
            options: cat.options.map(opt => ({ ...opt, id: String(opt.id) }))
        }));
        
        setFormData(prev => ({ ...prev, optionCategories: mappedOptionsData }));
        console.log(`Fetched options for ${selectedProduct.name}:`, mappedOptionsData);

      } catch (error: any) {
        console.error("Failed to fetch product options:", error);
        setSelectedProductOptionsError(`Failed to load options: ${error.message}`);
      } finally {
        setSelectedProductOptionsLoading(false);
      }
    };

    fetchOptions();
  }, [selectedProduct]); // Re-run this effect when selectedProduct changes

  // Add a new option category to the form data (Uses imported OptionCategory)
  const addOptionCategory = () => {
      if (!newCategoryName.trim()) return;
      // Need to specify selectionType when adding a new category
      const newCat: OptionCategory = { 
          id: `cat-${Date.now()}`, 
          name: newCategoryName.trim(), 
          selectionType: 'radio', // Default to radio, maybe add UI to select this?
          is_required: false, // Added default is_required to fix linter error
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
  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      console.log("Form Data on Save:", formData);
      
      // Basic validation (can be expanded)
      if (!formData.name.trim()) {
          alert("Product name is required.");
          return;
      }
      if (formData.categoryId === null) {
          alert("Please select a category for the product.");
          return;
      }
      if (isNaN(parseFloat(formData.price)) || parseFloat(formData.price) < 0) {
          alert("Please enter a valid, non-negative price.");
          return;
      }

      const apiEndpoint = isAdding ? 'http://localhost:3001/api/products' : `http://localhost:3001/api/products/${selectedProduct?.id}`;
      const method = isAdding ? 'POST' : 'PUT';
      
      // --- Prepare Headers --- 
      const token = localStorage.getItem('authToken');
      const headers: HeadersInit = {}; // Start with empty headers
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        console.warn("[EditMenu.tsx] Auth token not found in localStorage. Request might fail.");
      }

      // --- Prepare Body and Final Headers --- 
      let requestBody;
      if (formData.image) { // Using FormData
        const productFormData = new FormData();
        productFormData.append('name', formData.name.trim());
        productFormData.append('base_price', formData.price);
        if (formData.categoryId !== null) { productFormData.append('category_id', String(formData.categoryId)); }
        productFormData.append('description', formData.description || "Placeholder description");
        const optionGroupIds = formData.optionCategories.map(cat => parseInt(cat.id)).filter(id => !isNaN(id));
        optionGroupIds.forEach(id => productFormData.append('option_group_ids[]', String(id)));
        productFormData.append('productImage', formData.image);
        requestBody = productFormData;
        // DO NOT set Content-Type for FormData, browser handles it.
      } else { // Using JSON
        headers['Content-Type'] = 'application/json'; // Add Content-Type for JSON
        const productDataPayload = {
            name: formData.name.trim(),
            base_price: parseFloat(formData.price) || 0,
            category_id: formData.categoryId,
            image_url: formData.imagePreviewUrl && !formData.imagePreviewUrl.startsWith('blob:')
                         ? formData.imagePreviewUrl
                         : (selectedProduct && !isAdding ? selectedProduct.image : null),
            description: formData.description || "Placeholder description",
            option_group_ids: formData.optionCategories.map(cat => parseInt(cat.id)).filter(id => !isNaN(id)),
        };
        requestBody = JSON.stringify(productDataPayload);
      }

      // --- Prepare Fetch Options --- 
      const fetchOptions: RequestInit = {
          method: method,
          headers: headers, // Assign the final headers object
          body: requestBody,
      };

      console.log('[EditMenu.tsx] Sending fetch options:', fetchOptions); // Log before sending

      // --- Execute Fetch --- 
      try {
        const response = await fetch(apiEndpoint, fetchOptions);

        if (!response.ok) {
          let errorData: any = { message: `HTTP error! status: ${response.status}` }; // Default error
          try {
            // Try parsing JSON error ONLY if Content-Type suggests it, otherwise use text
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              errorData = await response.json();
            } else {
              // Get text for non-JSON errors (like plain "Unauthorized")
              const errorText = await response.text(); 
              errorData.message = errorText || errorData.message; // Use text if available
            }
          } catch (parseError) {
            console.error("[EditMenu.tsx] Failed to parse error response:", parseError);
            // Keep the default HTTP error message
          }
          // Throw an error with the message from backend or the HTTP status
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        // --- Process Success Response (keep as is) ---
        const savedProductData = await response.json();
        console.log(isAdding ? "Product Added:" : "Product Updated:", savedProductData);
        const productForState: Product = {
            id: savedProductData.product_id,
            name: savedProductData.name,
            price: parseFloat(savedProductData.base_price),
            image: savedProductData.image_url || '/src/assets/product.png',
            category: fetchedCategories.find(c => c.category_id === savedProductData.category_id)?.name || 'Unknown',
            description: savedProductData.description,
            optionCategories: formData.optionCategories,
            availability: savedProductData.availability,
            tags: savedProductData.tags ? (Array.isArray(savedProductData.tags) ? savedProductData.tags : String(savedProductData.tags).split(',')) : [],
        };
        if (isAdding) {
            setProducts(prev => [productForState, ...prev]);
            handleSelectProduct(productForState);
            setIsAdding(false);
        } else {
            setProducts(prev => prev.map(p => p.id === productForState.id ? productForState : p));
            setSelectedProduct(productForState);
            setFormData(prev => ({ ...prev, image: null, imagePreviewUrl: productForState.image }));
        }
        alert(`Product ${isAdding ? 'added' : 'updated'} successfully!`);

      } catch (error: any) {
        console.error(`Failed to ${isAdding ? 'add' : 'update'} product:`, error);
        alert(`Error: ${error.message || 'Failed to save product. Please try again.'}`);
      }
  };

  // Placeholder for canceling edit/add
  const handleCancel = () => {
      setSelectedProduct(null);
      setIsAdding(false);
      setFormData(prev => ({ ...defaultFormState, categoryId: null })); // Explicitly reset categoryId on cancel
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
      image: formData.imagePreviewUrl || '/src/assets/product.png',
      optionCategories: formData.optionCategories,
      category: formData.categoryId?.toString() || '',
      id: -1 // Indicate preview/new product
  };

  // Helper functions for dynamic option management
  const handleNewOptionValueChange = (categoryId: string, value: string) => {
      setNewOptionValues(prev => ({ ...prev, [categoryId]: value }));
  };

  const startEditCategoryName = (category: OptionCategory) => {
      setEditingCategoryName(prev => ({ ...prev, [category.id]: category.name }));  };

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
  const handleAddCategory = async () => { // Make async
      if (!newCategoryInput.trim()) return;
      
      const endpoint = 'http://localhost:3001/api/categories';
      let requestBody;
      const token = localStorage.getItem('authToken'); // Get token
      const headers: HeadersInit = {}; // Initialize headers object

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const fetchOptions: RequestInit = {
          method: 'POST',
          headers: headers, // Assign headers
      };

      if (newCategoryImageFile) {
        const categoryFormData = new FormData();
        categoryFormData.append('name', newCategoryInput.trim());
        categoryFormData.append('categoryImage', newCategoryImageFile); 
        requestBody = categoryFormData;
        // Content-Type set by browser for FormData
      } else {
        // Send as JSON if no new image file
        headers['Content-Type'] = 'application/json'; // Add Content-Type for JSON
        fetchOptions.headers = headers; // Re-assign updated headers

        requestBody = JSON.stringify({
          name: newCategoryInput.trim(),
          image_url: null 
        });
      }
      fetchOptions.body = requestBody;

      try {
        const response = await fetch(endpoint, fetchOptions); // Now includes Authorization header

        if (!response.ok) {
            const errorData = await response.json(); // Attempt to parse error response
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const createdCategory = await response.json();
        console.log("Category Added:", createdCategory);

        // Update local state with the category returned from the API
        // Ensure createdCategory matches FetchedCategory structure (e.g., category_id, name, image_url)
        setFetchedCategories(prev => [...prev, createdCategory]);
        // Optionally, set the new category as active
        setActiveCategory(createdCategory.name);
        setActiveCategoryId(createdCategory.category_id);

        // Reset form states
        setNewCategoryInput('');
        setNewCategoryImageFile(null);
        if (newCategoryImagePreviewUrl && newCategoryImagePreviewUrl.startsWith('blob:')) {
           URL.revokeObjectURL(newCategoryImagePreviewUrl); // Clean up blob
        }
        setNewCategoryImagePreviewUrl(undefined);
        setIsAddingCategory(false);
        alert('Category added successfully!');

      } catch (error: any) {
          console.error("Failed to add category:", error);
          alert(`Error adding category: ${error.message}`);
          // Do not reset form on error, allow user to retry/correct if appropriate
      }
  };

  const handleDeleteCategory = async (categoryToDeleteId: number, categoryToDeleteName: string) => {
       // TODO: Need a better way to check product usage - ideally an API check or fetch all products first.
       // For now, use the local products state as a basic client-side check (might be incomplete)
       const productsInCategory = products.filter(p => p.category === categoryToDeleteName);
       
       let confirmDelete = true; 
       if (productsInCategory.length > 0) {
           confirmDelete = window.confirm(
              `Category "${categoryToDeleteName}" contains ${productsInCategory.length} product(s) based on current view. Deleting the category might be blocked by the server if other products exist.\n\nAre you sure you want to attempt to delete this category?`
           );
       }
        if (fetchedCategories.length <= 1) {
            alert("Cannot delete the last category.");
            return;
        }

       if (confirmDelete) {
          try {
            const token = localStorage.getItem('authToken'); // Get token
            const headers: HeadersInit = {};
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
            } else {
              console.warn('[EditMenu.tsx] Auth token not found for deleting category.');
              // Optionally, prevent the call or alert the user if token is critical
            }

            const response = await fetch(`http://localhost:3001/api/categories/${categoryToDeleteId}`, {
                method: 'DELETE',
                headers: headers, // Add headers to the fetch call
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            // Update availableCategories state
            setFetchedCategories(prev => prev.filter(cat => cat.category_id !== categoryToDeleteId));

            // Update activeCategory if the deleted one was active
            if (activeCategoryId === categoryToDeleteId) {
                const remainingCategories = fetchedCategories.filter(cat => cat.category_id !== categoryToDeleteId);
                setActiveCategoryId(remainingCategories.length > 0 ? remainingCategories[0].category_id : null);
            }

            handleCancel(); // Reset product selection/form
            alert('Category deleted successfully.');
            console.log(`Deleted category ID: ${categoryToDeleteId}`);

          } catch (error: any) {
            console.error("Failed to delete category:", error);
            alert(`Error deleting category: ${error.message}`);
          }
       }
  };

  // --- Fetch Options for Selected Option Group ---
  useEffect(() => {
    if (!selectedOptionGroupForOptions) {
      setOptionsForSelectedGroup([]); // Clear options if no group is selected
      return;
    }

    const fetchOptionsForGroup = async () => {
      setOptionsLoading(true);
      setOptionsError(null);
      try {
        const token = localStorage.getItem('authToken'); // Get token
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        } else {
          console.warn('[EditMenu.tsx] Auth token not found for fetching options for group.');
        }

        const response = await fetch(`http://localhost:3001/api/option-groups/${selectedOptionGroupForOptions.option_group_id}/options`, {
          headers: headers, // Add headers
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: ProductOption[] = await response.json(); // Assuming backend returns ProductOption compatible structure
        setOptionsForSelectedGroup(data.map(opt => ({ ...opt, id: String(opt.id) }))); // Ensure IDs are strings for frontend consistency
      } catch (error: any) {
        console.error("Failed to fetch options for group:", error);
        setOptionsError(`Failed to load options: ${error.message}`);
      } finally {
        setOptionsLoading(false);
      }
    };

    fetchOptionsForGroup();
  }, [selectedOptionGroupForOptions]);

  // --- NEW: Function to handle saving option group edits ---
  const handleUpdateOptionGroup = async (groupId: number) => {
    if (!editOptionGroupName.trim()) {
      alert("Option group name cannot be empty.");
      return;
    }

    const token = localStorage.getItem('authToken');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.warn('[EditMenu.tsx] Auth token not found for updating option group.');
    }

    try {
      const payload = {
        name: editOptionGroupName.trim(), 
        selection_type: editOptionGroupSelectionType, 
        is_required: editOptionGroupIsRequired // This state holds the new desired value
      };
      console.log('[EditMenu.tsx] Updating option group with payload:', payload);

      const response = await fetch(`http://localhost:3001/api/option-groups/${groupId}`, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMsg = `HTTP error! ${response.status}`;
        try { const errData = await response.json(); errorMsg = errData.message || errorMsg; } catch(e){}
        throw new Error(errorMsg);
      }

      const updatedGroupFromApi: BackendOptionGroup = await response.json();
      console.log('[EditMenu.tsx] Received updated group from API:', updatedGroupFromApi);
      
      // Update local list of all option groups
      setOptionGroups(prev => prev.map(og => og.option_group_id === groupId ? updatedGroupFromApi : og));
      
      // If a product is currently being edited, update its assigned optionCategories array
      if (selectedProduct && formData.optionCategories) {
        setFormData(prevFormData => {
          const newOptionCategories = prevFormData.optionCategories.map(cat => {
            if (cat.id === String(groupId)) {
              // This is the category that was just updated
              console.log(`[EditMenu.tsx] Updating formData.optionCategories for ID ${groupId} to match API response.`);
              return {
                ...cat, // Keep existing options array and other props if any
                name: updatedGroupFromApi.name, // Update name from API response
                selectionType: updatedGroupFromApi.selection_type, // Update type
                is_required: updatedGroupFromApi.is_required // Crucially, update is_required
              };
            }
            return cat;
          });
          return { ...prevFormData, optionCategories: newOptionCategories };
        });
      }

      setEditingGroupId(null); // Exit editing mode for the option group list
      alert('Option Group updated successfully!');

    } catch (err: any) {
      console.error("Failed to update option group:", err);
      alert(`Error updating option group: ${err.message}`);
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
          {categoriesLoading && <p className="text-gray-500">Loading categories...</p>}
          {categoriesError && <p className="text-red-500">{categoriesError}</p>}
          {!categoriesLoading && !categoriesError && fetchedCategories.map(category => (
          <button
                key={category.category_id}
                 onClick={() => {
                    setActiveCategoryId(category.category_id); // Set ID instead of name
                    handleCancel(); 
                 }}
                 className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors mb-2 ${ 
                    activeCategoryId === category.category_id // Compare IDs
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-stone-200'
                 }`}
             >
               {/* TODO: Use category.image_url here if available */}
               {category.name}
               {/* TODO: Update Delete Category logic to use category.category_id and require API call */} 
               {!isAddingCategory && fetchedCategories.length > 1 && ( 
          <button
                       onClick={(e) => { 
                        e.stopPropagation(); 
                        handleDeleteCategory(category.category_id, category.name); // Pass ID and Name
                       }}
                    title={`Delete category "${category.name}"`}
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
                     {newCategoryImagePreviewUrl && (
                        <img src={newCategoryImagePreviewUrl} alt="Category preview" className="h-8 w-8 object-contain border rounded bg-white p-0.5" />
                     )}
                     <button onClick={handleAddCategory} className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700">Save</button>
                     <button type="button" onClick={() => categoryImageInputRef.current?.click()} className="text-xs px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 ml-2">Image</button>
                     <button onClick={() => { setIsAddingCategory(false); setNewCategoryInput(''); setNewCategoryImageFile(null); setNewCategoryImagePreviewUrl(undefined); }} className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300">Cancel</button>
                </div>
           )}
        </div>

        {/* Hidden File Input for Category Image */}
        <input 
          type="file" 
          accept="image/*" 
          ref={categoryImageInputRef} 
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setNewCategoryImageFile(file);
              if (newCategoryImagePreviewUrl && newCategoryImagePreviewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(newCategoryImagePreviewUrl);
              }
              setNewCategoryImagePreviewUrl(URL.createObjectURL(file));
            } else {
              setNewCategoryImageFile(null);
              if (newCategoryImagePreviewUrl && newCategoryImagePreviewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(newCategoryImagePreviewUrl);
              }
              setNewCategoryImagePreviewUrl(undefined);
            }
            e.target.value = ''; // Reset file input value to allow re-selection of the same file
          }}
          className="hidden"
        />

        {/* Product Grid */}
        <p className="text-sm text-gray-600 mb-4">
            {/* Display active category name based on ID, and use filteredProducts.length */}
            {activeCategoryId !== null 
                ? `${productsLoading ? 'Loading...' : fetchedCategories.find(c => c.category_id === activeCategoryId)?.name || 'Selected Category'}: ${filteredProducts.length} products available` 
                : categoriesLoading ? 'Loading Categories...' : (fetchedCategories.length > 0 ? 'Select a category' : 'No categories available')
            }
        </p>
        {productsLoading && <p className="text-gray-500">Loading products...</p>}
        {productsError && <p className="text-red-500">{productsError}</p>}
        {!productsLoading && !productsError && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 overflow-y-auto pr-2 flex-1">
            {/* Filtering is now handled by filteredProducts definition */}
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
        )}
      </div>

      {/* Right Sidebar - Product Preview & Edit Form */}
      <div className="w-96 bg-white rounded-2xl p-5 shadow flex flex-col border border-gray-100 h-full overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-brown-800">{isAdding ? 'Add New Product' : selectedProduct ? 'Edit Product' : 'Product Details'}</h2>
             {selectedProduct && !isAdding && (
                  <button 
                     onClick={async () => { // Make async
                         if (!selectedProduct) return;
                         if (window.confirm(`Are you sure you want to delete ${selectedProduct.name}?`)) {
                              console.log("Deleting product:", selectedProduct.id);
                              try {
                                const token = localStorage.getItem('authToken'); // Get token
                                const headers: HeadersInit = {};
                                if (token) headers['Authorization'] = `Bearer ${token}`;
                                else console.warn('[EditMenu.tsx] Token not found for deleting product.');

                                const response = await fetch(`http://localhost:3001/api/products/${selectedProduct.id}`, {
                                  method: 'DELETE',
                                  headers: headers, // Add headers
                                });
                                if (!response.ok) {
                                  let errorMsg = `HTTP error! ${response.status}`;
                                  try { const errData = await response.json(); errorMsg = errData.message || errorMsg; } catch(e){}
                                  throw new Error(errorMsg);
                                }
                                // Remove from local state on success
                              setProducts(prev => prev.filter(p => p.id !== selectedProduct.id));
                              handleCancel(); // Clear selection and form
                                alert('Product deleted successfully.');
                              } catch (error: any) {
                                console.error("Failed to delete product:", error);
                                alert(`Error deleting product: ${error.message}`);
                              }
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
              <form onSubmit={handleSave} className="flex flex-col">
                 <h3 className="text-md font-semibold text-brown-800 mb-3">{isAdding ? 'Enter details' : 'Edit details'}</h3>
                 <p className="text-xs text-gray-400 text-right mb-2">#012706</p> { /* Placeholder ID? */}
                 
                  <div className="space-y-4 overflow-y-auto pr-2 mb-4"> { /* Make form scrollable */}
                     {/* Product Type - Now dynamic */}
                     <div className="mb-3">
                         <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                         <div className="flex flex-wrap gap-2">
                            {categoriesLoading && <p className="text-xs text-gray-500">Loading...</p>}
                            {categoriesError && <p className="text-xs text-red-500">Error loading categories</p>}
                            {!categoriesLoading && !categoriesError && fetchedCategories.map(cat => (
                                 <button 
                                     key={cat.category_id}
                                     type="button" // Prevent form submission
                                     onClick={() => setFormData(prev => ({...prev, categoryId: cat.category_id}))} // Set categoryId
                                     className={`px-3 py-1.5 rounded-lg text-xs border font-medium transition-colors ${ 
                                        formData.categoryId === cat.category_id // Compare categoryId
                                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                            : 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200 hover:border-stone-300'
                                     }`}
                                 >
                                     {/* Optional: Display cat.image_url here */}
                                     {cat.name}
                                 </button>
                             ))}
                            {!categoriesLoading && fetchedCategories.length === 0 && <p className="text-xs text-gray-500">No categories available. Add one first.</p>} 
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

                    {/* Assign Option Groups Section - REPLACES old Dynamic Options UI */}
                    <div className="border-t border-gray-200 pt-4 mt-4">
                        <h4 className="text-lg font-semibold text-brown-800 mb-3">Assign Option Groups to Product</h4>
                        {optionGroupsLoading && <p className="text-xs text-gray-500">Loading option groups...</p>}
                        {optionGroupsError && <p className="text-xs text-red-500">{optionGroupsError}</p>}
                        {!optionGroupsLoading && !optionGroupsError && optionGroups.length === 0 && 
                            <p className="text-xs text-gray-500">No option groups available. Please create some in the "Manage Option Groups" section first.</p>}
                        
                        {!optionGroupsLoading && !optionGroupsError && optionGroups.length > 0 && (
                            <div className="space-y-2 max-h-48 overflow-y-auto border p-3 rounded-md bg-stone-50/70">
                                {optionGroups.map(og => {
                                    // Check if this option group (by its ID) is already in formData.optionCategories
                                    const isSelected = formData.optionCategories.some(cat => cat.id === String(og.option_group_id));
                                    return (
                                        <label key={og.option_group_id} className="flex items-center space-x-2.5 p-2 hover:bg-stone-100 rounded-md text-sm cursor-pointer transition-colors">
                                          <input 
                                                type="checkbox"
                                                className="form-checkbox h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 focus:ring-offset-0"
                                                checked={isSelected}
                                                onChange={async e => {
                                                    const { checked } = e.target;
                                                    if (checked) {
                                                        // Add this option group and its options to formData.optionCategories
                                                        try {
                                                            setOptionsLoading(true); // Indicate loading for this specific action
                                                            const token = localStorage.getItem('authToken');
                                                            const headers: HeadersInit = {};
                                                            if (token) {
                                                              headers['Authorization'] = `Bearer ${token}`;
                                                            }
                                                            const response = await fetch(`http://localhost:3001/api/option-groups/${og.option_group_id}/options`, {
                                                              headers: headers,
                                                            });
                                                            if (!response.ok) throw new Error('Failed to fetch options for group ' + og.name);
                                                            const fetchedOptions: ProductOption[] = await response.json();
                                                            const newCategoryToAdd: OptionCategory = {
                                                                id: String(og.option_group_id),
                                                                name: og.name,
                                                                selectionType: og.selection_type,
                                                                is_required: og.is_required,
                                                                options: fetchedOptions.map(opt => ({...opt, id: String(opt.id)}))
                                                            };
                                                            setFormData(prev => ({ ...prev, optionCategories: [...prev.optionCategories, newCategoryToAdd] }));
                                                        } catch (err:any) {
                                                            console.error("Error adding option group to product:", err);
                                                            alert(err.message || "Could not load options for this group. Try again.");
                                                        } finally {
                                                            setOptionsLoading(false); // Reset loading state
                                                        }
                                                    } else {
                                                        // Remove this option group from formData.optionCategories
                                                        setFormData(prev => ({ 
                                                            ...prev, 
                                                            optionCategories: prev.optionCategories.filter(cat => cat.id !== String(og.option_group_id))
                                                        }));
                                                    }
                                                }}
                                            />
                                            <span>{og.name} <span className="text-xs text-gray-400">({og.selection_type})</span></span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                        {/* The old UI for adding/editing option categories & options directly within the product form is now removed. 
                           Users should manage Option Groups and their Options in the dedicated section, 
                           then assign those pre-defined groups to products here. */}
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

      {/* Option Groups Management Section (New) */}
      <div className="my-8 pt-6 border-t border-gray-200 flex-shrink-0">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-brown-900">Manage Option Groups</h2>
          {!isAddingOptionGroup && (
                                              <button 
              onClick={() => setIsAddingOptionGroup(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-purple-700 transition-colors"
            >
              <img src="/src/assets/add.svg" alt="" className="w-4 h-4" />
              Add Option Group
                                              </button>
          )}
                                          </div>

        {isAddingOptionGroup && (
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 mb-4">
            <h3 className="text-lg font-medium text-purple-800 mb-3">Create New Option Group</h3>
            {/* Use flex-wrap instead of grid for better responsiveness */}
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-grow min-w-[150px]">
                <label htmlFor="newOptionGroupName" className="block text-xs font-medium text-gray-700 mb-1">Group Name</label>
                <input
                  type="text"
                  id="newOptionGroupName"
                  value={newOptionGroupName}
                  onChange={(e) => setNewOptionGroupName(e.target.value)}
                  className="form-input"
                  placeholder="e.g., Size, Milk Type"
                />
              </div>
              <div>
                <label htmlFor="newOptionGroupSelectionType" className="block text-xs font-medium text-gray-700 mb-1">Selection Type</label>
                <select 
                  id="newOptionGroupSelectionType"
                  value={newOptionGroupSelectionType}
                  onChange={(e) => setNewOptionGroupSelectionType(e.target.value as 'radio' | 'checkbox')}
                  className="form-select"
                >
                  <option value="radio">Radio (Select One)</option>
                  <option value="checkbox">Checkbox (Select Many)</option>
                </select>
              </div>
              {/* Added Is Required Checkbox for New Option Group */}
              <div className="flex items-center pt-5">
                <input 
                  type="checkbox" 
                  id="newOptionGroupIsRequired"
                  checked={newOptionGroupIsRequired}
                  onChange={(e) => setNewOptionGroupIsRequired(e.target.checked)}
                  className="form-checkbox h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                />
                <label htmlFor="newOptionGroupIsRequired" className="ml-2 text-xs font-medium text-gray-700">Is this group required?</label>
              </div>

              <div className="flex space-x-2 flex-shrink-0">
                <button 
                  onClick={async () => {
                    if (!newOptionGroupName.trim()) {
                      alert("Option group name cannot be empty.");
                      return;
                    }
                    try {
                      const token = localStorage.getItem('authToken');
                      const headers: HeadersInit = { 'Content-Type': 'application/json' };
                      if (token) {
                        headers['Authorization'] = `Bearer ${token}`;
                      }
                      const response = await fetch('http://localhost:3001/api/option-groups', {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify({ 
                          name: newOptionGroupName, 
                          selection_type: newOptionGroupSelectionType, 
                          is_required: newOptionGroupIsRequired
                        }),
                      });
                      if (!response.ok) {
                        let errorMsg = `HTTP error! ${response.status}`;
                        try { 
                            const errData = await response.json(); 
                            errorMsg = errData.message || errorMsg; 
                        } catch(e){ /* Ignore parse error if body not json */ }
                        throw new Error(errorMsg);
                      }
                      const createdGroup: BackendOptionGroup = await response.json();
                      setOptionGroups(prev => [...prev, createdGroup]);
                      setNewOptionGroupName('');
                      setNewOptionGroupSelectionType('radio');
                      setNewOptionGroupIsRequired(false);
                      setIsAddingOptionGroup(false);
                      alert('Option Group created successfully!');
                    } catch (err:any) {
                      console.error("Failed to create option group:", err);
                      alert(`Error: ${err.message}`);
                    }
                  }}
                  className="form-save-button py-1.5 bg-purple-500 hover:bg-purple-600 flex-1"
                >
                  Save Group
                </button>
                <button 
                  onClick={() => {
                    setIsAddingOptionGroup(false);
                    setNewOptionGroupName('');
                    setNewOptionGroupSelectionType('radio');
                    setNewOptionGroupIsRequired(false);
                  }}
                  className="form-cancel-button py-1.5 flex-1"
                >
                  Cancel
                </button>
                               </div>
              </div>
          </div>
        )}

        {optionGroupsLoading && <p className="text-gray-500">Loading option groups...</p>}
        {optionGroupsError && <p className="text-red-500">{optionGroupsError}</p>}
        {!optionGroupsLoading && !optionGroupsError && (
          <div className="space-y-3">
            {optionGroups.length === 0 && !isAddingOptionGroup && (
              <p className="text-gray-500 text-center py-4">No option groups found. Click "Add Option Group" to create one.</p>
            )}
            {optionGroups.map(group => (
              <div key={group.option_group_id} className="p-3 border border-gray-200 rounded-lg bg-white shadow-sm flex justify-between items-center">
                {editingGroupId === group.option_group_id ? (
                  // --- Inline Edit Form ---
                  <div className="flex-1 flex flex-wrap gap-2 items-center mr-4">
                    <input 
                      type="text" 
                      value={editOptionGroupName}
                      onChange={(e) => setEditOptionGroupName(e.target.value)}
                      className="form-input text-sm py-1 px-2 flex-grow min-w-[120px]"
                    />
                    <select 
                      value={editOptionGroupSelectionType} 
                      onChange={(e) => setEditOptionGroupSelectionType(e.target.value as 'radio' | 'checkbox')}
                      className="form-select text-sm py-1 px-2"
                    >
                      <option value="radio">Radio</option>
                      <option value="checkbox">Checkbox</option>
                    </select>
                    {/* Added Is Required Checkbox for Editing Option Group */}
                    <div className="flex items-center">
                      <input 
                        type="checkbox" 
                        id={`editOptionGroupIsRequired-${group.option_group_id}`}
                        checked={editOptionGroupIsRequired}
                        onChange={(e) => setEditOptionGroupIsRequired(e.target.checked)}
                        className="form-checkbox h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                      />
                      <label htmlFor={`editOptionGroupIsRequired-${group.option_group_id}`} className="ml-1.5 text-xs font-medium text-gray-700">Required</label>
                    </div>
                    <button onClick={() => handleUpdateOptionGroup(group.option_group_id)} className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200">Save</button>
                    <button onClick={() => setEditingGroupId(null)} className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">Cancel</button>
                  </div>
                ) : (
                  // --- Display View ---
                  <div className="flex-1 mr-4">
                    <p className="font-medium text-gray-800">
                      {group.name}
                      {group.is_required && <span className="text-xs text-red-500 font-semibold ml-1.5">(Required)</span>}
                    </p>
                    <p className="text-xs text-gray-500">Type: {group.selection_type} (ID: {group.option_group_id})</p>
                  </div>
                )}
                
                {editingGroupId !== group.option_group_id && (
                  <div className="flex space-x-2 flex-shrink-0">
                    <button 
                      onClick={() => {
                        setEditingGroupId(group.option_group_id);
                        setEditOptionGroupName(group.name);
                        setEditOptionGroupSelectionType(group.selection_type);
                        setEditOptionGroupIsRequired(group.is_required);
                      }}
                      className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                    >
                      Edit Group
                    </button>
                    <button 
                      onClick={() => setSelectedOptionGroupForOptions(group)} 
                      className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                    >
                      Options
                    </button>
                    <button 
                      onClick={async () => {
                        if (window.confirm(`Are you sure you want to delete the option group "${group.name}"? This action cannot be undone.`)) {
                          try {
                            const token = localStorage.getItem('authToken'); // Get token
                            const headers: HeadersInit = {};
                            if (token) {
                              headers['Authorization'] = `Bearer ${token}`;
                            } else {
                              console.warn('[EditMenu.tsx] Auth token not found for deleting option group.');
                            }
                            const response = await fetch(`http://localhost:3001/api/option-groups/${group.option_group_id}`, {
                              method: 'DELETE',
                              headers: headers, // Add headers
                            });
                            if (!response.ok) {
                              const errData = await response.json();
                              throw new Error(errData.message || `HTTP error! ${response.status}`);
                            }
                            setOptionGroups(prev => prev.filter(og => og.option_group_id !== group.option_group_id));
                            alert('Option Group deleted successfully!');
                          } catch (err: any) {
                            console.error("Failed to delete option group:", err);
                            alert(`Error: ${err.message}`);
                          }
                        }
                      }}
                      className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
                 </div>

      {/* Section to Display and Manage Options for Selected Group */}
      {selectedOptionGroupForOptions && (
        <div className="my-8 pt-6 border-t border-gray-200 flex-shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-brown-800">
              Options for "{selectedOptionGroupForOptions.name}"
            </h3>
            <button onClick={() => {
              setIsAddingOption(true);
              setEditingOption(null); // Clear any editing option state
              setOptionFormLabel(''); 
              setOptionFormPriceModifier('');
            }} className="quick-action-button">
              + Add New Option
                   </button>
          </div>

          {optionsLoading && <p className="text-gray-500">Loading options...</p>}
          {optionsError && <p className="text-red-500">{optionsError}</p>}
          
          {!optionsLoading && !optionsError && (
            optionsForSelectedGroup.length === 0 && !isAddingOption ? (
              <p className="text-gray-500 text-center py-3">No options defined for this group yet.</p>
            ) : (
              <div className="space-y-2">
                {optionsForSelectedGroup.map(opt => (
                  <div key={opt.id} className="p-2.5 border border-gray-100 rounded-md bg-white flex justify-between items-center text-sm">
                    <span>{opt.label} {opt.priceModifier ? `(+$${parseFloat(String(opt.priceModifier)).toFixed(2)})` : ''}</span>
                    <div className="flex space-x-1.5">
                      <button 
                        onClick={() => {
                          setEditingOption(opt);
                          setIsAddingOption(false); // Not adding, but editing
                          setOptionFormLabel(opt.label);
                          setOptionFormPriceModifier(opt.priceModifier !== undefined ? String(opt.priceModifier) : '');
                        }}
                        className="text-xs p-1 rounded text-yellow-600 hover:bg-yellow-100"
                      >
                        Edit
                      </button>
                      <button 
                         onClick={async () => {
                          if (window.confirm(`Are you sure you want to delete option "${opt.label}"?`)) {
                            try {
                              const token = localStorage.getItem('authToken'); // Get token
                              const headers: HeadersInit = {};
                              if (token) {
                                headers['Authorization'] = `Bearer ${token}`;
                              } else {
                                console.warn('[EditMenu.tsx] Auth token not found for deleting option.');
                              }
                              const response = await fetch(`http://localhost:3001/api/options/${opt.id}`, {
                                method: 'DELETE',
                                headers: headers, // Add headers
                              });
                              if (!response.ok) { 
                                const errData = await response.json(); 
                                throw new Error(errData.message || `HTTP error ${response.status}`); 
                              }
                              setOptionsForSelectedGroup(prev => prev.filter(o => o.id !== opt.id));
                              alert('Option deleted.');
                            } catch (err:any) { alert(`Error: ${err.message}`); }
                          }
                        }}
                        className="text-xs p-1 rounded text-red-500 hover:bg-red-100"
                      >
                        Delete
                   </button>
                 </div>
                  </div>
                ))}
              </div>
            )
          )}

          {(isAddingOption || editingOption) && (
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="text-md font-medium text-gray-700 mb-2">{isAddingOption ? 'Add New Option' : 'Edit Option'}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                      <label className="block text-xs text-gray-600 mb-0.5">Option Label</label>
                      <input type="text" value={optionFormLabel} onChange={e => setOptionFormLabel(e.target.value)} className="form-input text-sm" placeholder="e.g., Small, Almond Milk" />
                  </div>
                  <div>
                      <label className="block text-xs text-gray-600 mb-0.5">Price Modifier (e.g., 0.50 or -0.25)</label>
                      <input type="number" step="0.01" value={optionFormPriceModifier} onChange={e => setOptionFormPriceModifier(e.target.value)} className="form-input text-sm" placeholder="0.00"/>
                  </div>
                  <div className="flex space-x-2">
                      <button 
                          onClick={async () => {
                              if (!optionFormLabel.trim()) { alert("Option label is required."); return; }
                              const payload = {
                                  option_group_id: selectedOptionGroupForOptions!.option_group_id,
                                  label: optionFormLabel.trim(),
                                  price_modifier: parseFloat(optionFormPriceModifier) || 0.00
                              };
                              const url = editingOption ? `http://localhost:3001/api/options/${editingOption.id}` : 'http://localhost:3001/api/options';
                              const method = editingOption ? 'PUT' : 'POST';
                              try {
                                  const token = localStorage.getItem('authToken'); // Get token
                                  const headers: HeadersInit = {'Content-Type':'application/json'};
                                  if (token) {
                                    headers['Authorization'] = `Bearer ${token}`;
                                  } else {
                                    console.warn('[EditMenu.tsx] Auth token not found for saving option.');
                                  }
                                  const response = await fetch(url, {
                                    method,
                                    headers: headers, // Use updated headers object
                                    body: JSON.stringify(payload)
                                  });
                                  if(!response.ok){ const err = await response.json(); throw new Error(err.message || `HTTP Error ${response.status}`);}
                                  const savedOption: ProductOption = await response.json();
                                  const finalSavedOption = {...savedOption, id: String(savedOption.id)}; // Ensure ID is string

                                  if(editingOption){
                                      setOptionsForSelectedGroup(prev => prev.map(o => o.id === finalSavedOption.id ? finalSavedOption : o));
                                  } else {
                                      setOptionsForSelectedGroup(prev => [...prev, finalSavedOption]);
                                  }
                                  setIsAddingOption(false); setEditingOption(null); setOptionFormLabel(''); setOptionFormPriceModifier('');
                                  alert(`Option ${editingOption ? 'updated' : 'added'}!`);
                              } catch (err:any) { alert(`Error: ${err.message}`); }
                          }}
                          className="form-save-button py-1.5 flex-1 text-sm"
                      >
                         {editingOption ? 'Save Changes' : 'Add Option'}
                      </button>
                       <button onClick={() => { setIsAddingOption(false); setEditingOption(null);}} className="form-cancel-button py-1.5 flex-1 text-sm">Cancel</button>
                  </div>
              </div>
            </div>
          )}
        </div>
      )}

      </div>
    </div>
  );
};

export default EditMenu; 
