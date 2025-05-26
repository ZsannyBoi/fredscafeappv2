import React, { useState, useEffect, useRef } from 'react';
// Import shared types
import { Product, ProductOption, OptionCategory, BackendOptionGroup } from '../types'; 
import ImageUpload from '../components/ImageUpload';
import { uploadImage } from '../utils/imageUpload';

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
    categoryId: number | null;
    name: string;
    price: string;
    image: File | null;
    imagePreviewUrl: string;
    description: string;
    optionCategories: OptionCategory[];
    availability: 'available' | 'unavailable';
    tags: string[];
}

// Default empty form state
const defaultFormState: ProductFormData = {
    categoryId: null,
    name: '',
    price: '',
    image: null,
    imagePreviewUrl: '/src/assets/product.png',
    description: '',
    optionCategories: [],
    availability: 'available',
    tags: []
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
  
  // --- New State for Availability Filter ---
  type AvailabilityFilterType = 'all' | 'available' | 'unavailable';
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilterType>('all');

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

  // --- State for Editing Category ---
  const [editingCategory, setEditingCategory] = useState<FetchedCategory | null>(null);
  const [editCategoryNameInput, setEditCategoryNameInput] = useState('');
  const [editCategoryImageFile, setEditCategoryImageFile] = useState<File | null>(null);
  const [editCategoryImagePreviewUrl, setEditCategoryImagePreviewUrl] = useState<string | undefined>(undefined);
  const editCategoryImageInputRef = useRef<HTMLInputElement>(null);

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
  const [optionFormValue, setOptionFormValue] = useState(''); // New state for option value
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

  // Filter products based on the selected category ID OR availability filter
  const filteredProducts = (() => {
    let productsToFilter = [...products]; // Start with all products

    // Apply availability filter first if it's not 'all'
    if (availabilityFilter === 'available') {
      productsToFilter = productsToFilter.filter(p => p.availability === 'available' || p.availability === undefined);
    } else if (availabilityFilter === 'unavailable') {
      productsToFilter = productsToFilter.filter(p => p.availability === 'unavailable');
    }

    // Then, if a specific category is selected (and availabilityFilter was 'all' or has already been applied)
    // apply category filtering. If availability filter is active, category selection is ignored for now.
    if (availabilityFilter === 'all' && activeCategoryId !== null) {
      productsToFilter = productsToFilter.filter(p => {
        const productCategoryId = fetchedCategories.find(cat => cat.name === p.category)?.category_id;
        return productCategoryId === activeCategoryId;
      });
    }
    // If availabilityFilter is active (not 'all'), activeCategoryId is effectively ignored for this iteration of filtering logic.
    // The display text below will need to reflect this.

    return productsToFilter;
  })();

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
        categoryId: selectedCategoryId,
        name: product.name,
        price: product.price.toString(),
        image: null,
        imagePreviewUrl: product.image || '/src/assets/product.png',
        description: product.description || '',
        optionCategories: copiedOptionCategories,
        availability: product.availability || 'available',
        tags: product.tags || []
    });
    console.log("Selected Product:", product);
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
      if (editCategoryImagePreviewUrl && editCategoryImagePreviewUrl.startsWith('blob:')) { // Clean up edit preview
        URL.revokeObjectURL(editCategoryImagePreviewUrl);
      }
    };
  }, [newCategoryImagePreviewUrl, editCategoryImagePreviewUrl]); // Add editCategoryImagePreviewUrl

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
          category: p.category_name,
          description: p.description || '',
          optionCategories: [], // Will be populated later
          availability: p.availability || 'available',
          tags: p.tags ? p.tags.split(',').filter(Boolean) : []
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
      if (!formData.description.trim()) {
          alert("Product description is required.");
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
      if (formData.image instanceof File) {
        // First upload the image
        const imageFormData = new FormData();
        imageFormData.append('image', formData.image);
        
        const token = localStorage.getItem('authToken');
        const imageUploadResponse = await fetch('http://localhost:3001/api/upload/image', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: imageFormData
        });

        if (!imageUploadResponse.ok) {
          throw new Error('Failed to upload image');
        }

        const imageData = await imageUploadResponse.json();
        
        // Now send the product update with the new image URL
        headers['Content-Type'] = 'application/json';
        const productDataPayload = {
            name: formData.name.trim(),
            base_price: parseFloat(formData.price),
            category_id: formData.categoryId,
            image_url: imageData.url, // Use the URL from the image upload response
            description: formData.description.trim(),
            availability: formData.availability,
            tags: formData.tags,
            option_group_ids: formData.optionCategories.map(cat => parseInt(cat.id)).filter(id => !isNaN(id))
        };
        requestBody = JSON.stringify(productDataPayload);
      } else {
        // No new image, just update other fields
        headers['Content-Type'] = 'application/json';
        const productDataPayload = {
            name: formData.name.trim(),
            base_price: parseFloat(formData.price),
            category_id: formData.categoryId,
            description: formData.description.trim(),
            availability: formData.availability,
            tags: formData.tags,
            option_group_ids: formData.optionCategories.map(cat => parseInt(cat.id)).filter(id => !isNaN(id))
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
            description: savedProductData.description || '',
            optionCategories: formData.optionCategories,
            availability: savedProductData.availability || 'available',
            tags: savedProductData.tags ? savedProductData.tags.split(',').filter(Boolean) : []
        };
        if (isAdding) {
            setProducts(prev => [productForState, ...prev]);
            handleSelectProduct(productForState);
            setIsAdding(false);
        } else {
            setProducts(prev => prev.map(p => p.id === productForState.id ? productForState : p));
            setSelectedProduct(productForState);
            setFormData(prev => ({
                ...prev,
                image: null,
                imagePreviewUrl: productForState.image,
                tags: productForState.tags || []
            }));
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
      setEditingCategory(null); // Reset editing category state
      setEditCategoryImageFile(null);
      setEditCategoryImagePreviewUrl(undefined);
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
  const handleAddCategory = async () => {
    if (!newCategoryInput.trim()) return;
    
    const endpoint = 'http://localhost:3001/api/categories';
    const token = localStorage.getItem('authToken');
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const formData = new FormData();
    formData.append('name', newCategoryInput.trim());
    if (newCategoryImageFile) {
      formData.append('image', newCategoryImageFile);
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...headers
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const createdCategory = await response.json();
      setFetchedCategories(prev => [...prev, createdCategory]);
      setActiveCategoryId(createdCategory.category_id);

      // Reset form states
      setNewCategoryInput('');
      setNewCategoryImageFile(null);
      if (newCategoryImagePreviewUrl && newCategoryImagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(newCategoryImagePreviewUrl);
      }
      setNewCategoryImagePreviewUrl(undefined);
      setIsAddingCategory(false);
      alert('Category added successfully!');

    } catch (error: any) {
      console.error("Failed to add category:", error);
      alert(`Error adding category: ${error.message}`);
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

  // --- NEW: Function to handle starting category edit ---
  const handleStartEditCategory = (category: FetchedCategory) => {
    setEditingCategory(category);
    setEditCategoryNameInput(category.name);
    setEditCategoryImagePreviewUrl(category.image_url || undefined);
    setEditCategoryImageFile(null); // Reset file input
    setIsAddingCategory(false); // Ensure add category form is hidden
  };

  // --- NEW: Function to handle category update submission ---
  const handleUpdateCategory = async () => {
    if (!editingCategory || !editCategoryNameInput.trim()) {
      alert("Category name cannot be empty.");
      return;
    }

    const endpoint = `http://localhost:3001/api/categories/${editingCategory.category_id}`;
    const token = localStorage.getItem('authToken');
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const formData = new FormData();
    formData.append('name', editCategoryNameInput.trim());
    
    if (editCategoryImageFile) {
      formData.append('image', editCategoryImageFile);
    } else if (editCategoryImagePreviewUrl === null) {
      // If image preview is null, it means we want to remove the image
      formData.append('image_url', 'null');
    }

    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          ...headers
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
        throw new Error(errorData.message || 'Failed to update category.');
      }

      const updatedCategory: FetchedCategory = await response.json();
      setFetchedCategories(prev => prev.map(cat => cat.category_id === updatedCategory.category_id ? updatedCategory : cat));
      
      if (activeCategoryId === editingCategory.category_id) {
        setActiveCategory(updatedCategory.name);
      }

      setEditingCategory(null);
      setEditCategoryImageFile(null);
      setEditCategoryImagePreviewUrl(undefined);
      alert('Category updated successfully!');
    } catch (error: any) {
      console.error("Failed to update category:", error);
      alert(`Error updating category: ${error.message}`);
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
        const data: any[] = await response.json(); // Raw data from API
        // Correctly map API response (option_id, label, price_modifier) to ProductOption type (id, label, priceModifier)
        setOptionsForSelectedGroup(data.map(apiOpt => {
          if (apiOpt.option_id === null || apiOpt.option_id === undefined) {
            console.warn('[EditMenu] Fetched option missing valid option_id:', apiOpt);
            return {
              id: `invalid-${Date.now()}`,
              label: apiOpt.label || 'Invalid Option (Missing ID)',
              priceModifier: parseFloat(apiOpt.price_modifier) || 0,
              value: apiOpt.value || ''
            };
          }
          return {
            id: String(apiOpt.option_id),       // Map option_id to id
            label: apiOpt.label,
            priceModifier: parseFloat(apiOpt.price_modifier) || 0, // Ensure number
            value: apiOpt.value || '' // Handle optional value field
          };
        }).filter(opt => opt && opt.id && !opt.id.startsWith('invalid-'))); // Filter out any clearly invalid ones
      } catch (error: any) {
        console.error("Failed to fetch options for group:", error);
        setOptionsError(`Failed to load options: ${error.message}`);
      } finally {
        setOptionsLoading(false);
      }
    };

    fetchOptionsForGroup();
  }, [selectedOptionGroupForOptions]);

  // --- NEW: Function to handle ADDING a new option group via API ---
  const handleAddOptionGroup = async () => {
    if (!newOptionGroupName.trim()) {
      alert("Option group name cannot be empty.");
      return;
    }

    const token = localStorage.getItem('authToken');
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const payload = {
        name: newOptionGroupName.trim(),
        selection_type: newOptionGroupSelectionType,
        is_required: newOptionGroupIsRequired,
      };
      console.log('[EditMenu.tsx] Adding option group with payload:', payload);

      const response = await fetch('http://localhost:3001/api/option-groups', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMsg = `HTTP error! ${response.status}`;
        try { 
          const errData = await response.json(); 
          errorMsg = errData.message || errorMsg; 
        } catch(e){ /* Ignore parsing error if response not JSON */ }
        throw new Error(errorMsg);
      }

      const createdGroupFromApi: BackendOptionGroup = await response.json();
      console.log('[EditMenu.tsx] Received created group from API:', createdGroupFromApi);
      
      // Update local list of all option groups
      setOptionGroups(prev => [...prev, createdGroupFromApi]);
      
      // Reset form and close add mode
      setIsAddingOptionGroup(false);
      setNewOptionGroupName('');
      setNewOptionGroupSelectionType('radio');
      setNewOptionGroupIsRequired(false);

      alert('Option Group added successfully!');

    } catch (err: any) {
      console.error("Failed to add option group:", err);
      alert(`Error adding option group: ${err.message}`);
    }
  };

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

  // --- NEW: Function to handle DELETING an option group via API ---
  const handleDeleteOptionGroup = async (groupId: number) => {
    if (!window.confirm('Are you sure you want to delete this option group? This might affect products using it.')) {
      return;
    }

    const token = localStorage.getItem('authToken');
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      console.log(`[EditMenu.tsx] Deleting option group with ID: ${groupId}`);

      const response = await fetch(`http://localhost:3001/api/option-groups/${groupId}`, {
        method: 'DELETE',
        headers: headers,
      });

      if (!response.ok) {
        let errorMsg = `HTTP error! ${response.status}`;
        try { 
          const errData = await response.json(); 
          errorMsg = errData.message || errorMsg; 
        } catch(e){ /* Ignore parsing error if response not JSON */ }
        throw new Error(errorMsg);
      }

      // Update local list of all option groups
      setOptionGroups(prev => prev.filter(og => og.option_group_id !== groupId));
      
      // If the deleted group was selected for managing options, clear that selection
      if (selectedOptionGroupForOptions?.option_group_id === groupId) {
        setSelectedOptionGroupForOptions(null);
      }
      // If the deleted group was being edited, clear that state
      if (editingGroupId === groupId) {
        setEditingGroupId(null);
      }

      alert('Option Group deleted successfully!');

    } catch (err: any) {
      console.error("Failed to delete option group:", err);
      alert(`Error deleting option group: ${err.message}`);
    }
  };

  // --- Function to ADD an Option to a specific Option Group ---
  const handleAddOptionToGroup = async () => {
    if (!selectedOptionGroupForOptions || !optionFormLabel.trim()) {
      alert("Option label cannot be empty and an option group must be selected.");
      return;
    }

    const token = localStorage.getItem('authToken');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const payload = {
      option_group_id: selectedOptionGroupForOptions.option_group_id, 
      label: optionFormLabel.trim(),
      price_modifier: optionFormPriceModifier.trim() === '' ? null : parseFloat(optionFormPriceModifier),
      value: optionFormValue.trim() || undefined, // Include value
    };
    console.log('[EditMenu] Adding option to group with payload:', payload); // Log payload

    try {
      const response = await fetch(`http://localhost:3001/api/options`, { 
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
        console.error('[EditMenu] API Error adding option:', errData, 'Status:', response.status);
        throw new Error(errData.message);
      }

      const newOptionFromApi = await response.json(); // Expects { option_id, label, price_modifier, value? }
      console.log('[EditMenu] Received new option from API:', newOptionFromApi);

      const newOptionForState: ProductOption = {
        id: String(newOptionFromApi.option_id),
        label: newOptionFromApi.label,
        priceModifier: newOptionFromApi.price_modifier !== null && newOptionFromApi.price_modifier !== undefined ? parseFloat(newOptionFromApi.price_modifier) : undefined,
        value: newOptionFromApi.value || '' 
      };
      console.log('[EditMenu] Prepared new option for state:', newOptionForState);

      setOptionsForSelectedGroup(prev => [...prev, newOptionForState]);
      console.log('[EditMenu] State `optionsForSelectedGroup` updated after add.');

      setIsAddingOption(false);
      setOptionFormLabel('');
      setOptionFormValue(''); 
      setOptionFormPriceModifier('');
      alert('Option added successfully!');

    } catch (err: any) {
      console.error("[EditMenu] Failed to add option to group:", err);
      alert(`Error adding option: ${err.message}`);
    }
  };

  // --- Function to UPDATE an Option in a specific Option Group ---
  const handleUpdateOptionInGroup = async () => {
    if (!editingOption || !editingOption.id || editingOption.id === 'undefined' || !selectedOptionGroupForOptions || !optionFormLabel.trim()) {
      alert("Required information for updating option is missing, or option ID is invalid.");
      console.error('[EditMenu] Attempted to update option with invalid editingOption state:', editingOption, 'Selected Group:', selectedOptionGroupForOptions, 'Form Label:', optionFormLabel);
      return;
    }
    console.log('[EditMenu] Starting update for option:', editingOption, 'with form label:', optionFormLabel);

    const token = localStorage.getItem('authToken');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const payload = {
      label: optionFormLabel.trim(),
      price_modifier: optionFormPriceModifier.trim() === '' ? null : parseFloat(optionFormPriceModifier),
      value: optionFormValue.trim() || undefined, // Include value
    };
    console.log(`[EditMenu] Updating option ${editingOption.id} with payload:`, payload);

    try {
      const response = await fetch(`http://localhost:3001/api/options/${editingOption.id}`, { 
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
        console.error('[EditMenu] API Error updating option:', errData, 'Status:', response.status);
        throw new Error(errData.message);
      }

      const updatedOptionFromApi = await response.json(); // Expects { option_id, label, price_modifier, option_group_id, value? }
      console.log('[EditMenu] Received updated option from API:', updatedOptionFromApi);

      const updatedOptionForState: ProductOption = {
        id: String(updatedOptionFromApi.option_id),
        label: updatedOptionFromApi.label,
        priceModifier: updatedOptionFromApi.price_modifier !== null && updatedOptionFromApi.price_modifier !== undefined ? parseFloat(updatedOptionFromApi.price_modifier) : undefined,
        value: updatedOptionFromApi.value || '' 
      };
      console.log('[EditMenu] Prepared updated option for state:', updatedOptionForState);

      setOptionsForSelectedGroup(prev => prev.map(opt => opt.id === updatedOptionForState.id ? updatedOptionForState : opt));
      console.log('[EditMenu] State `optionsForSelectedGroup` updated after update.');

      setIsAddingOption(false); 
      setEditingOption(null);   
      setOptionFormLabel('');
      setOptionFormValue(''); 
      setOptionFormPriceModifier('');
      alert('Option updated successfully!');

    } catch (err: any) {
      console.error("[EditMenu] Failed to update option in group:", err);
      alert(`Error updating option: ${err.message}`);
    }
  };

  // --- Function to DELETE an Option from a specific Option Group ---
  const handleDeleteOptionFromGroup = async (optionId: string | undefined) => {
    if (!optionId || !selectedOptionGroupForOptions) {
      alert("Option ID or selected group is missing for deletion.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this option?")) return;

    const token = localStorage.getItem('authToken');
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const response = await fetch(`http://localhost:3001/api/options/${optionId}`, {
        method: 'DELETE',
        headers: headers,
      });

      if (!response.ok) {
        // Handle cases where backend might send non-JSON error (e.g., plain text or just status)
        let errorDetail = `HTTP error ${response.status}`;
        if (response.headers.get("content-type")?.includes("application/json")) {
            const errData = await response.json().catch(() => (null)); // Avoid crashing if JSON parse fails
            errorDetail = errData?.message || errorDetail;
        } else {
            const textError = await response.text().catch(() => (null));
            errorDetail = textError || errorDetail;
        }
        throw new Error(errorDetail);
      }

      // If DELETE was successful, backend might send back 204 No Content or a success message.
      // We don't strictly need to parse a body for a successful DELETE.
      
      setOptionsForSelectedGroup(prev => prev.filter(opt => opt.id !== optionId));
      alert('Option deleted successfully!');

    } catch (err: any) {
      console.error("Failed to delete option from group:", err);
      alert(`Error deleting option: ${err.message}`);
    }
  };

  const handleProductImageChange = async (file: File | null, previewUrl: string) => {
      try {
          let imageUrl = previewUrl;
          if (file) {
              imageUrl = await uploadImage(file);
          }
          setFormData(prev => ({
              ...prev,
              image: file,
              imagePreviewUrl: imageUrl
          }));
      } catch (err: any) {
          console.error('Error updating product image:', err);
          setError(err.message || 'Failed to update product image');
      }
  };

  const handleCategoryImageChange = async (file: File | null, previewUrl: string) => {
      try {
          let imageUrl = previewUrl;
          if (file) {
              imageUrl = await uploadImage(file);
          }
          setEditingCategory(prev => prev ? {
              ...prev,
              image_url: imageUrl
          } : null);
      } catch (err: any) {
          console.error('Error updating category image:', err);
          setError(err.message || 'Failed to update category image');
      }
  };

  const [error, setError] = useState<string | null>(null);

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

        {/* Category Filters */}
        <div className="flex space-x-2 mb-6 items-center flex-wrap">
          {/* Availability Filters */}
          {(['all', 'available', 'unavailable'] as AvailabilityFilterType[]).map(filterType => (
            <button
              key={filterType}
              onClick={() => {
                setAvailabilityFilter(filterType);
                setActiveCategoryId(null);
                handleCancel();
              }}
              className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors mb-2 ${
                availabilityFilter === filterType
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-stone-200'
              }`}
            >
              {filterType.charAt(0).toUpperCase() + filterType.slice(1)} Products
            </button>
          ))}

          <div className="h-6 border-l border-gray-300 mx-2 mb-2"></div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2">
            {categoriesLoading && <p className="text-gray-500">Loading categories...</p>}
            {categoriesError && <p className="text-red-500">{categoriesError}</p>}
            {!categoriesLoading && !categoriesError && fetchedCategories.map(category => (
              <div
                role="button"
                tabIndex={0}
                key={category.category_id}
                onClick={() => {
                  setActiveCategoryId(category.category_id);
                  setAvailabilityFilter('all');
                  handleCancel();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setActiveCategoryId(category.category_id);
                    setAvailabilityFilter('all');
                    handleCancel();
                  }
                }}
                className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors mb-2 cursor-pointer ${
                  activeCategoryId === category.category_id
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-stone-200'
                }`}
              >
                {/* Category Image */}
                {category.image_url && (
                  <img
                    src={category.image_url}
                    alt={category.name}
                    className="w-6 h-6 object-cover rounded"
                  />
                )}
                <span>{category.name}</span>
                <div className="flex items-center">
                  {!isAddingCategory && !editingCategory && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEditCategory(category);
                        }}
                        title={`Edit category "${category.name}"`}
                        className="p-1 rounded-full text-blue-400 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCategory(category.category_id, category.name);
                        }}
                        title={`Delete category "${category.name}"`}
                        className="p-1 rounded-full text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* Add Category Button/Form */}
            {!isAddingCategory ? (
              <button
                onClick={() => setIsAddingCategory(true)}
                className="ml-2 text-emerald-600 hover:text-emerald-800 text-sm font-medium mb-2 p-2 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors"
              >
                + Add Category
              </button>
            ) : (
              <div className="flex items-center space-x-2 mb-2 ml-2 p-2 border border-emerald-200 rounded-lg bg-emerald-50/50">
                <input
                  type="text"
                  placeholder="New category name..."
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddCategory();
                    if (e.key === 'Escape') {
                      setIsAddingCategory(false);
                      setNewCategoryInput('');
                    }
                  }}
                  className="form-input px-2 py-1 text-sm w-36"
                  autoFocus
                />
                {newCategoryImagePreviewUrl && (
                  <img
                    src={newCategoryImagePreviewUrl}
                    alt="Category preview"
                    className="h-8 w-8 object-contain border rounded bg-white p-0.5"
                  />
                )}
                <button
                  onClick={handleAddCategory}
                  className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => categoryImageInputRef.current?.click()}
                  className="text-xs px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
                >
                  Image
                </button>
                <button
                  onClick={() => {
                    setIsAddingCategory(false);
                    setNewCategoryInput('');
                    setNewCategoryImageFile(null);
                    setNewCategoryImagePreviewUrl(undefined);
                  }}
                  className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
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
            e.target.value = '';
          }}
          className="hidden"
        />

        {/* Product Grid */}
        <p className="text-sm text-gray-600 mb-3">
            {/* Display active filter type */}
            {availabilityFilter !== 'all'
              ? `${availabilityFilter.charAt(0).toUpperCase() + availabilityFilter.slice(1)} Products: ${filteredProducts.length} available`
              : activeCategoryId !== null
                ? `${productsLoading ? 'Loading...' : fetchedCategories.find(c => c.category_id === activeCategoryId)?.name || 'Selected Category'}: ${filteredProducts.length} products available` 
                : categoriesLoading ? 'Loading Categories...' : (fetchedCategories.length > 0 ? 'Select a category or filter' : 'No products or categories available')
            }
        </p>
        {productsLoading && <p className="text-gray-500">Loading products...</p>}
        {productsError && <p className="text-red-500">{productsError}</p>}
        {!productsLoading && !productsError && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 overflow-y-auto pr-2 flex-1"> 
            {/* Filtering is now handled by filteredProducts definition - Removed sub-groupings */}
            {filteredProducts.length > 0 ? (
              <>
                {filteredProducts.map(product => (
                  <div
                    key={product.id} // Changed key to be simpler since we are not duplicating by availability status here
                    className={`bg-white rounded-xl p-4 shadow border hover:shadow-lg transition-all cursor-pointer relative flex flex-col justify-between min-h-[280px] ${selectedProduct?.id === product.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-100'} ${product.availability === 'unavailable' ? 'opacity-70' : ''}`}>
                      <div onClick={() => handleSelectProduct(product)} className="cursor-pointer mb-2 text-center flex-grow flex flex-col items-center">
                        {product.availability === 'unavailable' && (
                            <span className="absolute top-2 right-2 bg-slate-400 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full z-10">Unavailable</span>
                        )}
                        <img src={product.image} alt={product.name} className="w-32 h-32 object-contain mx-auto mb-3" />
                        <h3 className="text-md font-semibold text-brown-900 mb-1">{product.name}</h3>
                        <p className="text-sm text-gray-700 mb-2">${product.price.toFixed(2)}</p>
                      </div>
                      {/* Availability Toggle Button */}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation(); // Prevent card click from firing
                          const newAvailability = product.availability === 'unavailable' ? 'available' : 'unavailable';
                          
                          // Optimistically update local state for all products
                          setProducts(prevProducts => 
                              prevProducts.map(p => 
                                  p.id === product.id ? { ...p, availability: newAvailability } : p
                              )
                          );
                          // If this product is currently selected for full edit, update its form data too
                          if (selectedProduct && selectedProduct.id === product.id) {
                              setFormData(prevFormData => ({ 
                                  ...prevFormData, 
                                  availability: newAvailability
                              }));
                          }

                          try {
                            const token = localStorage.getItem('authToken');
                            const response = await fetch(`http://localhost:3001/api/products/${product.id}/availability`, {
                                method: 'PATCH',
                                headers: {
                                    'Content-Type': 'application/json',
                                    ...(token && { 'Authorization': `Bearer ${token}` })
                                },
                                body: JSON.stringify({ availability: newAvailability })
                            });
                            if (!response.ok) {
                                const errorData = await response.json().catch(() => ({ message: 'Failed to update availability status.'}));
                                throw new Error(errorData.message);
                            }
                            const updatedProduct = await response.json();
                            // Ensure the products array reflects the confirmed backend state
                            setProducts(prevProducts => 
                                prevProducts.map(p => 
                                    p.id === updatedProduct.product_id ? { ...p, availability: updatedProduct.availability } : p
                                )
                            );
                            if (selectedProduct && selectedProduct.id === updatedProduct.product_id) {
                                setFormData(prevFormData => ({ 
                                    ...prevFormData, 
                                    availability: updatedProduct.availability
                                }));
                            }
                            console.log(`Availability for ${product.name} updated to ${newAvailability}`);
                          } catch (error: any) {
                              console.error("Error updating availability from card:", error);
                              alert(`Error: ${error.message}`);
                              // Revert optimistic update on error
                              setProducts(prevProducts => 
                                  prevProducts.map(p => 
                                      p.id === product.id ? { ...p, availability: product.availability } : p // Revert to original product.availability
                                  )
                              );
                              if (selectedProduct && selectedProduct.id === product.id) {
                                  const originalAvailability = product.availability || 'available';
                                  setFormData(prevFormData => ({ 
                                      ...prevFormData, 
                                      availability: originalAvailability
                                  }));
                              }
                          }
                        }}
                        className={`w-full mt-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          product.availability === 'unavailable' 
                            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {product.availability === 'unavailable' ? 'Make Available' : 'Make Unavailable'}
                      </button>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-gray-500 col-span-full text-center mt-10">No products found in this category.</p>
            )}
        </div>
        )}
      </div>

      {/* Right Sidebar - Product Preview & Edit Form */}
      <div className="w-96 bg-white rounded-2xl p-5 shadow flex flex-col border border-gray-100 h-full overflow-y-auto styled-scrollbar"> {/* Ensure this outer div is the main scroll container */}
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
                             <div className="flex items-center mb-2">
                               <p className="text-sm font-medium text-green-600 mr-2">${selectedProduct.price.toFixed(2)}</p>
                               {/* Detailed Availability Badge in Preview */}
                               {selectedProduct.availability === 'available' && (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Available</span>
                               )}
                               {selectedProduct.availability === 'unavailable' && (
                                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Unavailable</span>
                               )}
                             </div>
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

          {/* Wrapper for form and global option group management */}
          <div> 
            {/* Edit/Add Form Section */}
            {(selectedProduct || isAdding) && (
                <form onSubmit={handleSave} className="flex flex-col min-h-0">
                    <h3 className="text-md font-semibold text-brown-800 mb-3">{isAdding ? 'Enter details' : 'Edit details'}</h3>
                    
                    {/* Scrollable content area for main form fields */}
                    <div className="flex-1 space-y-4 overflow-y-auto pr-2 pb-4 styled-scrollbar">
                        {/* Product Type - Now dynamic */}
                        <div className="mb-2">
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

                              {/* Description */}
                              <div>
                                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                  <textarea 
                                      name="description" 
                                      id="description" 
                                      value={formData.description} 
                                      onChange={handleInputChange} 
                                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brown-400 text-sm"
                                      rows={4}
                                  />
                              </div>

                              {/* Assign Option Groups Section */}
                              <div className="mt-4">
                                  <h4 className="text-sm font-medium text-gray-700 mb-1.5">Assign Option Groups</h4>
                                  {optionGroupsLoading && <p className="text-xs text-gray-500">Loading groups...</p>}
                                  {optionGroupsError && <p className="text-xs text-red-500">Error: {optionGroupsError}</p>}
                                  {!optionGroupsLoading && !optionGroupsError && (
                                      <div className="max-h-48 overflow-y-auto space-y-1.5 border p-2.5 rounded-md bg-gray-50/50 styled-scrollbar"> {/* Increased max-h slightly */}
                                          {optionGroups.map(group => (
                                              <label key={group.option_group_id} className="flex items-center space-x-2 text-xs text-gray-700 hover:bg-gray-100 p-1.5 rounded">
                                                  <input 
                                                    type="checkbox"
                                                      className="form-checkbox h-3.5 w-3.5 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                                      checked={formData.optionCategories.some(cat => cat.id === String(group.option_group_id))}
                                                      onChange={(e) => {
                                                          const isChecked = e.target.checked;
                                                          setFormData(prevFormData => {
                                                              let updatedCategories = [...prevFormData.optionCategories];
                                                              if (isChecked) {
                                                                  // Add if not present
                                                                  if (!updatedCategories.some(cat => cat.id === String(group.option_group_id))) {
                                                                      updatedCategories.push({
                                                                          id: String(group.option_group_id),
                                                                          name: group.name,
                                                                          selectionType: group.selection_type,
                                                                          is_required: group.is_required,
                                                                          options: [] // Options are managed at the group level, not per-product assignment
                                                                      });
                                                            }
                                                        } else {
                                                                  // Remove if present
                                                                  updatedCategories = updatedCategories.filter(cat => cat.id !== String(group.option_group_id));
                                                              }
                                                              return { ...prevFormData, optionCategories: updatedCategories };
                                                          });
                                                      }}
                                                  />
                                                  <span>{group.name} ({group.selection_type}{group.is_required ? ', required' : ''})</span>
                                            </label>
                                          ))}
                                          {optionGroups.length === 0 && <p className="text-xs text-gray-400 italic py-2 text-center">No option groups created yet.</p>}
                                  </div>
                              )}
                          </div>
                              </div> {/* This closes the scrollable form content div */}

                              {/* Action Buttons for the main product form */}
                              <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3">
                         <button type="button" onClick={handleCancel} className="form-cancel-button">
                             Cancel
                         </button>
                         <button type="submit" className="form-save-button">
                             {isAdding ? 'Add Product' : 'Save Changes'}
                         </button>
                       </div>
                   </form>
               )} {/* This closes the selectedProduct || isAdding conditional rendering */}

               {/* Option Groups Management UI (OUTSIDE the main product form) */}
               <div className="my-6 pt-6 border-t border-gray-200">
                 <h3 className="text-xl font-semibold text-gray-800 mb-4">Manage Option Groups</h3>
                 
                 {/* Button to toggle Add Option Group form */}
                 {!isAddingOptionGroup && (
                    <button
                        onClick={() => {
                            setIsAddingOptionGroup(true);
                            // Reset new group form fields
                            setNewOptionGroupName('');
                            setNewOptionGroupSelectionType('radio');
                            setNewOptionGroupIsRequired(false);
                        }}
                        className="mb-4 bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                    >
                        + Add New Option Group
                    </button>
                 )}

                 {/* Add New Option Group Form */}
                 {isAddingOptionGroup && (
                    <div className="mb-6 p-4 border border-blue-200 rounded-lg bg-blue-50/50">
                        <h4 className="text-md font-semibold text-blue-700 mb-2">New Option Group</h4>
                        <div className="space-y-3">
                            <div>
                                <label htmlFor="newOptionGroupName" className="block text-xs font-medium text-gray-700 mb-0.5">Group Name</label>
                                <input 
                                    type="text" 
                                    id="newOptionGroupName"
                                    value={newOptionGroupName}
                                    onChange={(e) => setNewOptionGroupName(e.target.value)}
                                    className="form-input w-full text-sm"
                                    placeholder="e.g., Size, Milk Type"
                                />
                            </div>
                            <div>
                                <label htmlFor="newOptionGroupSelectionType" className="block text-xs font-medium text-gray-700 mb-0.5">Selection Type</label>
                                <select 
                                    id="newOptionGroupSelectionType"
                                    value={newOptionGroupSelectionType}
                                    onChange={(e) => setNewOptionGroupSelectionType(e.target.value as 'radio' | 'checkbox')}
                                    className="form-select w-full text-sm"
                                >
                                    <option value="radio">Radio (Select One)</option>
                                    <option value="checkbox">Checkbox (Select Multiple)</option>
                                </select>
                            </div>
                            <div className="flex items-center">
                                <input 
                                    type="checkbox" 
                                    id="newOptionGroupIsRequired"
                                    checked={newOptionGroupIsRequired}
                                    onChange={(e) => setNewOptionGroupIsRequired(e.target.checked)}
                                    className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <label htmlFor="newOptionGroupIsRequired" className="ml-2 text-xs font-medium text-gray-700">Is this group required?</label>
                            </div>
                        </div>
                        <div className="mt-3 flex space-x-2">
                            <button 
                                onClick={handleAddOptionGroup} // Use the new function here
                                className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                                disabled={!newOptionGroupName.trim()}
                            >
                                Save Group
                            </button>
                            <button onClick={() => setIsAddingOptionGroup(false)} className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300">Cancel</button>
                        </div>
                    </div>
                 )}

                 {/* List of Existing Option Groups */}
                 {optionGroupsLoading && <p className="text-sm text-gray-500">Loading option groups...</p>}
                 {optionGroupsError && <p className="text-sm text-red-500">Error: {optionGroupsError}</p>}
                 {!optionGroupsLoading && !optionGroupsError && (
                    <div className="space-y-3">
                        {optionGroups.length === 0 && !isAddingOptionGroup && (
                            <p className="text-sm text-gray-500 italic">No option groups created yet.</p>
                        )}
                        {optionGroups.map(group => (
                            <div key={group.option_group_id} className="p-3 border rounded-lg bg-stone-50/70 hover:shadow-sm transition-shadow">
                                {editingGroupId === group.option_group_id ? (
                                    // Inline Edit Form
                                    <div className="space-y-2">
                                        <div>
                                            <label htmlFor={`editOptionGroupName-${group.option_group_id}`} className="text-xs font-medium text-gray-600">Name</label>
                                            <input 
                                                type="text" 
                                                id={`editOptionGroupName-${group.option_group_id}`}
                                                value={editOptionGroupName} 
                                                onChange={(e) => setEditOptionGroupName(e.target.value)} 
                                                className="form-input w-full text-sm mt-0.5" 
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor={`editOptionGroupSelectionType-${group.option_group_id}`} className="text-xs font-medium text-gray-600">Type</label>
                                            <select 
                                                id={`editOptionGroupSelectionType-${group.option_group_id}`}
                                                value={editOptionGroupSelectionType} 
                                                onChange={(e) => setEditOptionGroupSelectionType(e.target.value as 'radio' | 'checkbox')} 
                                                className="form-select w-full text-sm mt-0.5"
                                            >
                                                <option value="radio">Radio</option>
                                                <option value="checkbox">Checkbox</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center pt-1">
                                            <input 
                                                type="checkbox" 
                                                id={`editOptionGroupIsRequired-${group.option_group_id}`}
                                                checked={editOptionGroupIsRequired}
                                                onChange={(e) => setEditOptionGroupIsRequired(e.target.checked)}
                                                className="form-checkbox h-3.5 w-3.5 text-blue-600 rounded border-gray-300"
                                            />
                                            <label htmlFor={`editOptionGroupIsRequired-${group.option_group_id}`} className="ml-1.5 text-xs text-gray-700">Required</label>
                                        </div>
                                        <div className="flex space-x-2 mt-2">
                                            <button onClick={() => handleUpdateOptionGroup(group.option_group_id)} className="px-2.5 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600">Save</button>
                                            <button onClick={() => setEditingGroupId(null)} className="px-2.5 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300">Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    // Display Mode
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-medium text-gray-800">{group.name}</h4>
                                            <p className="text-xs text-gray-600">
                                                Type: {group.selection_type} &bull; Required: {group.is_required ? 'Yes' : 'No'}
                                            </p>
                                        </div>
                                        <div className="flex space-x-1.5 flex-shrink-0">
                                            <button 
                                                onClick={() => {
                                                    setEditingGroupId(group.option_group_id);
                                                    setEditOptionGroupName(group.name);
                                                    setEditOptionGroupSelectionType(group.selection_type);
                                                    setEditOptionGroupIsRequired(group.is_required);
                                                }} 
                                                className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                                            >
                                                Edit Group
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteOptionGroup(group.option_group_id)} // Use the new function here
                                                className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200"
                                            >
                                                Delete Group
                                            </button>
                                            <button 
                                                onClick={() => setSelectedOptionGroupForOptions(group)}
                                                className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                                            >
                                                Manage Options ({optionsForSelectedGroup.length > 0 && selectedOptionGroupForOptions?.option_group_id === group.option_group_id ? optionsForSelectedGroup.length : '...'})
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                 )}

                {/* UI for Managing Options of a Selected Group */}
                {selectedOptionGroupForOptions && (
                    <div className="mt-6 pt-4 border-t border-dashed border-gray-300">
                        <h4 className="text-lg font-semibold text-gray-700 mb-3">
                            Options for: <span className="text-purple-600">{selectedOptionGroupForOptions.name}</span>
                        </h4>
                        {optionsLoading && <p className="text-sm text-gray-500">Loading options...</p>}
                        {optionsError && <p className="text-sm text-red-500">Error: {optionsError}</p>}
                        {!optionsLoading && !optionsError && (
                            <div>
                                {optionsForSelectedGroup.length === 0 && !isAddingOption && (
                                    <p className="text-sm text-gray-500 italic mb-2">No options defined for this group yet.</p>
                                )}
                                <div className="space-y-2 mb-3">
                                    {optionsForSelectedGroup.map(opt => (
                                        <div key={opt.id || opt.label} className="flex justify-between items-center p-2 bg-white border rounded-md text-sm">
                                            <span>{opt.label} {opt.priceModifier ? `(+$${opt.priceModifier.toFixed(2)})` : ''}</span>
                                            <div className="space-x-1.5">
                                                <button 
                                                    onClick={() => { setEditingOption(opt); setIsAddingOption(true); setOptionFormLabel(opt.label); setOptionFormValue(opt.value || ''); setOptionFormPriceModifier(String(opt.priceModifier || '')); }} 
                                                    className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded"
                                                >
                                                    Edit
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteOptionFromGroup(opt.id)}
                                                    className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {/* Add/Edit Option Form */}
                                {!isAddingOption && (
                                    <button 
                                        onClick={() => { setIsAddingOption(true); setEditingOption(null); setOptionFormLabel(''); setOptionFormValue(''); setOptionFormPriceModifier(''); }} 
                                        className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                                    >
                                        + Add Option
                                    </button>
                                )}
                                {isAddingOption && (
                                    <div className="p-3 border rounded-lg bg-green-50/50 mt-2 space-y-2">
                                        <h5 className="text-sm font-medium text-green-700">{editingOption ? 'Edit Option' : 'New Option'}</h5>
                                        <div>
                                            <label className="text-xs text-gray-600">Label</label>
                                            <input type="text" value={optionFormLabel} onChange={(e) => setOptionFormLabel(e.target.value)} className="form-input w-full text-sm mt-0.5" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-600">Value (optional, for internal use or if different from label)</label>
                                            <input type="text" value={optionFormValue} onChange={(e) => setOptionFormValue(e.target.value)} className="form-input w-full text-sm mt-0.5" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-600">Price Modifier (e.g., 0.50 or -0.25)</label>
                                            <input type="number" step="0.01" value={optionFormPriceModifier} onChange={(e) => setOptionFormPriceModifier(e.target.value)} className="form-input w-full text-sm mt-0.5" />
                                        </div>
                                        <div className="flex space-x-2">
                                            <button 
                                                onClick={editingOption ? handleUpdateOptionInGroup : handleAddOptionToGroup} 
                                                className="text-xs px-2 py-1 bg-green-600 text-white rounded"
                                                disabled={!optionFormLabel.trim()}
                                            >
                                                {editingOption ? 'Save Changes' : 'Add Option'}
                                            </button>
                                            <button onClick={() => { setIsAddingOption(false); setEditingOption(null); setOptionFormLabel(''); setOptionFormValue(''); setOptionFormPriceModifier(''); }} className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded">Cancel</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        <button 
                            onClick={() => setSelectedOptionGroupForOptions(null)} 
                            className="mt-4 text-xs px-2.5 py-1 bg-purple-500 text-white rounded hover:bg-purple-600"
                        >
                            Done Managing Options
                        </button>
                    </div>
                )}

              {/* Modal for Editing Category */}
              {editingCategory && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Edit Category: {editingCategory.name}</h3>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="editCategoryNameInput" className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                        <input
                          type="text"
                          id="editCategoryNameInput"
                          value={editCategoryNameInput}
                          onChange={(e) => setEditCategoryNameInput(e.target.value)}
                          className="form-input w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category Image</label>
                        <input
                          type="file"
                          accept="image/*"
                          ref={editCategoryImageInputRef}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setEditCategoryImageFile(file);
                              if (editCategoryImagePreviewUrl && editCategoryImagePreviewUrl.startsWith('blob:')) {
                                URL.revokeObjectURL(editCategoryImagePreviewUrl);
                              }
                              setEditCategoryImagePreviewUrl(URL.createObjectURL(file));
                            } else {
                              // Optionally allow clearing the image
                              // setEditCategoryImageFile(null);
                              // setEditCategoryImagePreviewUrl(undefined); 
                            }
                            e.target.value = ''; 
                          }}
                          className="form-input-file"
                        />
                        {editCategoryImagePreviewUrl && (
                          <div className="mt-2">
                            <img src={editCategoryImagePreviewUrl} alt="Category preview" className="h-20 w-20 object-contain border rounded bg-gray-50 p-1" />
                            <button 
                              type="button" 
                              onClick={() => {
                                setEditCategoryImageFile(null);
                                if (editCategoryImagePreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(editCategoryImagePreviewUrl);
                                setEditCategoryImagePreviewUrl(undefined);
                              }} 
                              className="text-xs text-red-500 hover:text-red-700 mt-1"
                            >
                              Remove Image
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                      <button type="button" onClick={() => { setEditingCategory(null); setEditCategoryImageFile(null); setEditCategoryImagePreviewUrl(undefined);}} className="form-cancel-button">
                        Cancel
                      </button>
                      <button type="button" onClick={handleUpdateCategory} className="form-save-button">
                        Save Changes
                      </button>
                    </div>
                  </div>
                    </div>
                )}
               </div>
             </div> {/* Closes the new wrapper div */}
        </div> {/* This closes the w-96 sidebar */}
    </div> /* This closes the main flex container */
  );
};

export default EditMenu; 

