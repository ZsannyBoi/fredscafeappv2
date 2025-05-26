import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User, EmployeeData, Product } from '../types'; // Renamed to avoid conflict

// Remove mock data as we will fetch from API
// const initialEmployeeData: EmployeeData[] = [...];
// const mockAllUsers: User[] = [...];

// Interface for the data structure used in the employees state, combining EmployeeData and User
interface DisplayEmployee extends EmployeeData {
  user: User;
}

// Define a more specific type for the employee details form
interface EmployeeFormDetails {
  employeeId: string;
  position: EmployeeData['position']; // Use the position type from EmployeeData
  phone_number?: string;
  status: EmployeeData['status']; // Use the status type from EmployeeData
  hireDate?: string;
  role?: User['role']; // Ensure this is here
  // Role (from User type) is not part of this form, position is the job title.
}

const Employee: React.FC = () => {
  const [employees, setEmployees] = useState<DisplayEmployee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<DisplayEmployee | null>(null);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState<string>(''); // New state for employee search

  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState<boolean>(false);
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [allAvailableUsers, setAllAvailableUsers] = useState<User[]>([]); // Store all fetched available users
  const [filteredUsersForModal, setFilteredUsersForModal] = useState<User[]>([]);
  const [selectedUserForEmployee, setSelectedUserForEmployee] = useState<User | null>(null);
  const [employeeDetails, setEmployeeDetails] = useState<EmployeeFormDetails>({
    employeeId: '',
    position: 'Other', // Default position from EmployeeData['position']
    phone_number: '',
    status: 'Active', 
    hireDate: '',
    role: 'employee', // Default role
  });
  const [editingEmployee, setEditingEmployee] = useState<DisplayEmployee | null>(null);
  const [employeeIdConflictError, setEmployeeIdConflictError] = useState<string | null>(null); // For employeeIdCode conflict

  const modalRef = useRef<HTMLDivElement>(null);

  // --- API Call State ---
  const [employeesLoading, setEmployeesLoading] = useState<boolean>(true);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  const [modalUsersLoading, setModalUsersLoading] = useState<boolean>(false);
  const [modalUsersError, setModalUsersError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false); // For add/edit/delete operations
  const [isLoading, setIsLoading] = useState<boolean>(false); // General loading state for actions
  const [error, setError] = useState<string | null>(null); // General error state for actions

  // --- Fetch Employees --- 
  const fetchEmployees = useCallback(async () => {
    setEmployeesLoading(true); // Use specific loading state for employee list
    setEmployeesError(null);   // Use specific error state for employee list
    try {
      const token = localStorage.getItem('authToken');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/employees', { headers });

      if (!response.ok) {
        let errorMessage = `Failed to fetch employees. Status: ${response.status}.`;
        const contentType = response.headers.get('content-type');
        try {
          const errorText = await response.text();
          if (contentType && contentType.includes('application/json')) {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorMessage;
          } else {
            // If not JSON, include a snippet of the text (likely HTML or plain text)
            errorMessage += ` Response (first 200 chars): ${errorText.substring(0, 200)}${errorText.length > 200 ? '...' : ''}`;
          }
        } catch (e) {
          // console.error("Additionally failed to parse error response body:", e);
          // Stick with the status code based message if parsing error text itself fails
        }
        throw new Error(errorMessage);
      }

      // If response.ok, we expect JSON.
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        const mappedEmployees: DisplayEmployee[] = data.map((emp: any) => ({
          id: emp.employee_internal_id.toString(),
          employeeId: emp.employee_id_code,
          employeeName: emp.employeeName,
          email: emp.email,
          position: emp.position,
          status: emp.status,
          hireDate: emp.hire_date ? new Date(emp.hire_date).toISOString().split('T')[0] : undefined,
          user: {
            internalId: emp.user_id?.toString() || '',
            email: emp.email || '',
            name: emp.employeeName || '',
            role: emp.user_role || 'customer',
            avatar: emp.avatar_url || undefined,
            referralCode: emp.referral_code || undefined,
            phone_number: emp.phone_number || undefined,
            address: emp.address || undefined,
          }
        }));
        setEmployees(mappedEmployees);
      } else {
        // response.ok was true, but content-type is not application/json
        const responseText = await response.text();
        throw new Error(`Server returned a 2xx status but the content type was '${contentType}' instead of JSON. Response (first 200 chars): ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
      }

    } catch (err) {
      console.error("Full error details in fetchEmployees:", err); // Log the full error object too
      setEmployeesError(err instanceof Error ? err.message : 'An unknown error occurred while fetching employees'); // Use specific error state
    } finally {
      setEmployeesLoading(false); // Use specific loading state
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // --- Fetch Available Users for Modal ---
  const fetchAvailableUsers = useCallback(async () => {
    if (!isAddEmployeeModalOpen) return;
    setModalUsersLoading(true);
    setModalUsersError(null);
    try {
      const token = localStorage.getItem('authToken');
      const apiResponse = await fetch('http://localhost:3001/api/users/available', { // Changed variable name
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!apiResponse.ok) {
        const errorData = await apiResponse.json().catch(() => ({ message: `HTTP error! Status: ${apiResponse.status}`}));
        throw new Error(errorData.message);
      }
      const data: Array<{ user_id: number; name: string; email: string; role: User['role'] }> = await apiResponse.json();
      
      const currentEmployeeEmails = new Set(employees.map(emp => emp.email));
      
      const mappedUsers: User[] = data
        .filter(u => !currentEmployeeEmails.has(u.email)) // Filter out users already in the employees list
        .map(u => ({
          internalId: u.user_id?.toString() || '',
          email: u.email,
          name: u.name,
          role: u.role,
        }));

      setAllAvailableUsers(mappedUsers);
      setFilteredUsersForModal(mappedUsers); 
    } catch (err: any) {
      console.error("Failed to fetch available users:", err);
      setModalUsersError(err.message || 'Failed to load users for modal.');
    } finally {
      setModalUsersLoading(false);
    }
  }, [isAddEmployeeModalOpen, employees]); // Add employees to dependency array for filtering

  useEffect(() => {
    fetchAvailableUsers();
  }, [fetchAvailableUsers]); // This will trigger when isAddEmployeeModalOpen changes due to fetchAvailableUsers deps

  // --- Client-side filtering for employee list ---
  const filteredEmployees = useMemo(() => {
    if (!employeeSearchTerm.trim()) {
      return employees;
    }
    const lowercasedSearchTerm = employeeSearchTerm.toLowerCase();
    return employees.filter(emp =>
      emp.employeeName.toLowerCase().includes(lowercasedSearchTerm) ||
      emp.employeeId.toLowerCase().includes(lowercasedSearchTerm) ||
      (emp.email || '').toLowerCase().includes(lowercasedSearchTerm) ||
      emp.position.toLowerCase().includes(lowercasedSearchTerm)
    );
  }, [employees, employeeSearchTerm]);

  // --- Client-side filtering for modal based on userSearchTerm ---
  useEffect(() => {
    if (userSearchTerm) {
      setFilteredUsersForModal(
        allAvailableUsers.filter(user =>
          user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(userSearchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredUsersForModal(allAvailableUsers); // If no search term, show all fetched available users
    }
  }, [userSearchTerm, allAvailableUsers]);

  const handleCloseAddEmployeeModal = () => {
    setIsAddEmployeeModalOpen(false);
    setUserSearchTerm('');
    setSelectedUserForEmployee(null);
    setModalUsersError(null);
    setEditingEmployee(null);
    setEmployeeIdConflictError(null); // Reset conflict error on close
    setEmployeeDetails({
      employeeId: '',
      position: 'Other',
      phone_number: '',
      status: 'Active',
      hireDate: '',
      role: 'employee', // Reset role on close
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        handleCloseAddEmployeeModal();
      }
    };
    if (isAddEmployeeModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAddEmployeeModalOpen]);

  const handleSelectEmployee = (employeeItem: DisplayEmployee) => {
    setSelectedEmployee(employeeItem);
  };

  const handleAddEmployeeClick = () => {
    setSelectedEmployee(null);
    setUserSearchTerm('');
    setSelectedUserForEmployee(null);
    setEditingEmployee(null);
    setEmployeeDetails({
      employeeId: '',
      position: 'Other',
      phone_number: '',
      status: 'Active',
      hireDate: '',
      role: 'employee', // Default role for new employee
    });
    setIsAddEmployeeModalOpen(true);
  };
  
  const handleUserSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserSearchTerm(e.target.value);
  };

  const handleSelectUserFromModal = (user: User) => {
    setSelectedUserForEmployee(user);
  };

  const handleEmployeeDetailsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEmployeeDetails(prev => ({ ...prev, [name]: value }));
    if (name === 'employeeId' || name === 'phone_number') {
      setEmployeeIdConflictError(null); // Reset conflict error when ID changes
    }
    setError(null); // Clear general form error on any change
  };

  const handleAddEmployee = async () => {
    if (!selectedUserForEmployee || !employeeDetails.employeeId.trim() || !employeeDetails.position || !employeeDetails.role) {
      setError('Please select a user, and fill in all required employee details (Employee ID, Position, Role).');
      return;
    }
    setIsLoading(true);
    setError(null);
    setEmployeeIdConflictError(null); // Reset before API call

    try {
      const token = localStorage.getItem('authToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          userEmail: selectedUserForEmployee.email,
          employeeIdCode: employeeDetails.employeeId.trim(),
          position: employeeDetails.position,
          phone_number: employeeDetails.phone_number?.trim() || null,
          hireDate: employeeDetails.hireDate ? new Date(employeeDetails.hireDate).toISOString() : new Date().toISOString(),
          status: employeeDetails.status,
          role: employeeDetails.role,
        }),
      });

      if (!response.ok) {
        let errorPayload: any = { message: `HTTP error ${response.status}` };
        try {
          errorPayload = await response.json();
          if (response.status === 409 && errorPayload.field === 'employeeIdCode') {
            setEmployeeIdConflictError(errorPayload.message);
            setError(null);
          } else if (response.status === 409 && errorPayload.field === 'userEmail') {
            setError(errorPayload.message);
            setEmployeeIdConflictError(null);
          } else {
            setError(errorPayload.message || `HTTP error ${response.status}`);
            setEmployeeIdConflictError(null);
          }
        } catch (parseError) {
          console.error("Failed to parse error JSON:", parseError);
          setError(`HTTP error ${response.status}. Could not parse error details.`);
          setEmployeeIdConflictError(null);
        }
        setIsLoading(false);
        return;
      }

      const addedEmployeeData: any = await response.json();
      const newDisplayEmployee: DisplayEmployee = {
        id: addedEmployeeData.employee_internal_id.toString(),
        employeeId: addedEmployeeData.employee_id_code,
        employeeName: addedEmployeeData.employeeName,
        email: addedEmployeeData.email,
        position: addedEmployeeData.position,
        status: addedEmployeeData.status,
        hireDate: addedEmployeeData.hire_date ? new Date(addedEmployeeData.hire_date).toISOString().split('T')[0] : undefined,
        user: {
          internalId: addedEmployeeData.user_id?.toString() || '',
          email: addedEmployeeData.email || '',
          name: addedEmployeeData.employeeName,
          role: addedEmployeeData.user_role,
          avatar: addedEmployeeData.avatar_url || undefined,
          referralCode: addedEmployeeData.referral_code || undefined,
          phone_number: addedEmployeeData.phone_number || undefined,
          address: addedEmployeeData.address || undefined,
        }
      };
      
      setEmployees(prev => [...prev, newDisplayEmployee]);
      fetchAvailableUsers();
      handleCloseAddEmployeeModal();
      setSelectedEmployee(newDisplayEmployee);

    } catch (err: any) {
      console.error("Error in handleAddEmployee:", err);
      setError(err.message || 'An unexpected error occurred while adding the employee.');
      setEmployeeIdConflictError(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEditModal = (employeeToEdit: DisplayEmployee) => {
    setEditingEmployee(employeeToEdit);
    setSelectedUserForEmployee(employeeToEdit.user);

    setEmployeeDetails({
        employeeId: employeeToEdit.employeeId,
        position: employeeToEdit.position, 
        phone_number: employeeToEdit.user.phone_number || '',
        status: employeeToEdit.status,
        hireDate: employeeToEdit.hireDate ? new Date(employeeToEdit.hireDate).toISOString().split('T')[0] : '',
        role: employeeToEdit.user.role || 'employee',
    });
    setIsAddEmployeeModalOpen(true);
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmployee || !employeeDetails.employeeId.trim() || !employeeDetails.position || !employeeDetails.role) {
      setError('Employee ID, Position, and Role are required.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setEmployeeIdConflictError(null); // Reset before API call
    try {
      const token = localStorage.getItem('authToken');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`/api/employees/${editingEmployee.id}`, {
        method: 'PUT',
        headers: headers, 
        body: JSON.stringify({
          employeeIdCode: employeeDetails.employeeId.trim(),
          position: employeeDetails.position, 
          status: employeeDetails.status,
          phone_number: employeeDetails.phone_number?.trim() || null,
          hireDate: employeeDetails.hireDate ? new Date(employeeDetails.hireDate).toISOString() : undefined,
          role: employeeDetails.role,
        }),
      });
      if (!response.ok) {
        let errorPayload: any = { message: 'Failed to update employee. Server returned an error.' };
        try {
            errorPayload = await response.json();
            if (response.status === 409 && errorPayload.field === 'employeeIdCode') {
                setEmployeeIdConflictError(errorPayload.message);
                setError(null);
            } else {
                setError(errorPayload.message || 'Failed to update employee');
                setEmployeeIdConflictError(null);
            }
        } catch (parseError) {
            console.error("Failed to parse error JSON:", parseError);
            setError(`HTTP error ${response.status}. Could not parse error details.`);
            setEmployeeIdConflictError(null);
        }
        setIsLoading(false);
        return; // Stop execution
      }
      
      const updatedEmployeeData: any = await response.json();
      const updatedDisplayEmployee: DisplayEmployee = {
        id: updatedEmployeeData.employee_internal_id.toString(),
        employeeId: updatedEmployeeData.employee_id_code,
        employeeName: updatedEmployeeData.employeeName,
        email: updatedEmployeeData.email,
        position: updatedEmployeeData.position,
        status: updatedEmployeeData.status,
        hireDate: updatedEmployeeData.hire_date ? new Date(updatedEmployeeData.hire_date).toISOString().split('T')[0] : undefined,
        user: {
          internalId: updatedEmployeeData.user_id?.toString() || '',
          email: updatedEmployeeData.email || '',
          name: updatedEmployeeData.employeeName,
          role: updatedEmployeeData.user_role,
          avatar: updatedEmployeeData.avatar_url || undefined,
          referralCode: updatedEmployeeData.referral_code || undefined,
          phone_number: updatedEmployeeData.phone_number || undefined,
          address: updatedEmployeeData.address || undefined,
        }
      };

      setEmployees(prevEmployees => 
        prevEmployees.map(emp => 
          emp.id === updatedDisplayEmployee.id ? updatedDisplayEmployee : emp
        )
      );

      if (selectedEmployee && selectedEmployee.id === updatedDisplayEmployee.id) {
        setSelectedEmployee(updatedDisplayEmployee);
      }

      closeModal();
    } catch (err: any) {
      console.error("Error in handleUpdateEmployee:", err);
      setError(err.message || 'An unexpected error occurred while updating the employee.');
      setEmployeeIdConflictError(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEmployee = async (employeeInternalId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this employee record? Their system role will be reverted to Customer.')) {
        return;
    }
    setIsLoading(true); // Or use isSaving if more appropriate for UI feedback
    setError(null);
    try {
      const token = localStorage.getItem('authToken');
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`/api/employees/${employeeInternalId}`, {
        method: 'DELETE',
        headers: headers,
      });

      if (!response.ok) {
        let errorData = { message: 'Failed to delete employee' };
        try {
            errorData = await response.json();
        } catch (e) { /* ignore parse error if not json */}
        throw new Error(errorData.message || 'Failed to delete employee');
      }

      // Successfully deleted from backend
      setEmployees(prevEmployees => prevEmployees.filter(emp => emp.id !== employeeInternalId));
      if (selectedEmployee && selectedEmployee.id === employeeInternalId) {
        setSelectedEmployee(null);
      }
      fetchAvailableUsers(); // Refresh the list of available users
      alert('Employee deleted successfully and their role reverted to customer.'); // Optional: Provide success feedback
      // No need to call closeModal() if the panel just disappears or shows a placeholder

    } catch (err: any) {
      console.error('Error deleting employee:', err);
      setError(err.message || 'An unknown error occurred while deleting employee.');
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setIsAddEmployeeModalOpen(false);
    setUserSearchTerm('');
    setSelectedUserForEmployee(null);
    setEditingEmployee(null); 
    setEmployeeDetails({
      employeeId: '',
      position: 'Other', 
      phone_number: '',
      status: 'Active',
      hireDate: '',
      role: 'employee', // Reset role
    });
    setError(null); 
    setModalUsersError(null);
  };

  // --- Render Logic --- 
  if (employeesLoading) {
    return <div className="p-6 text-center text-gray-500">Loading employees...</div>;
  }

  if (employeesError) {
    return <div className="p-6 text-center text-red-500">Error: {employeesError} <button onClick={fetchEmployees} className="ml-2 px-2 py-1 bg-blue-500 text-white rounded">Retry</button></div>;
  }

  return (
    <React.Fragment>
      <div className="text-brown-800 p-6 flex gap-6 h-[calc(100vh-theme(space.24))]">
        <div className="w-1/3 bg-white rounded-2xl p-5 shadow-lg flex flex-col border border-gray-100">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-xl font-semibold">Employees</h2>
                     <button 
                          onClick={handleAddEmployeeClick}
              className="quick-action-button"
              disabled={isSaving}
            >
              {isSaving ? 'Loading...' : '+ Add Employee'}
                     </button>
                 </div>
          <input 
            type="text" 
            placeholder="Search employees..." 
            className="form-input mb-4 text-sm" 
            value={employeeSearchTerm}
            onChange={(e) => setEmployeeSearchTerm(e.target.value)}
          />
          <ul className="space-y-2 overflow-y-auto flex-1 pr-1">
            {filteredEmployees.map((emp: DisplayEmployee) => (
              <li 
                key={emp.id}
                onClick={() => handleSelectEmployee(emp)}
                className={`p-3 rounded-lg cursor-pointer transition-colors hover:bg-amber-50 ${selectedEmployee?.id === emp.id ? 'bg-amber-100 border border-amber-300' : 'border border-transparent'}`}
              >
                <p className="font-medium text-gray-800">{emp.employeeName}</p>
                <p className="text-xs text-gray-500">{emp.position} - {emp.employeeId}</p>
              </li>
            ))}
            {employees.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No employees found.</p>}
            {employees.length > 0 && filteredEmployees.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                No employees found matching "{employeeSearchTerm}".
              </p>
            )}
          </ul>
            </div>

        <div className="flex-1 bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          {selectedEmployee ? (
            <EmployeeDetailsPanel 
              employee={selectedEmployee} 
              onEdit={() => handleOpenEditModal(selectedEmployee)} 
              onDelete={() => handleDeleteEmployee(selectedEmployee.id)} 
              disabled={isSaving || isLoading}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              <p>Select an employee from the list to see details, or click "Add Employee" to add a new one.</p>
                     </div>
                    )} 
                 </div>
            </div>
      {isAddEmployeeModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div ref={modalRef} className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-800">
                {editingEmployee ? `Edit Employee: ${editingEmployee.employeeName}` : 
                 selectedUserForEmployee ? `Assign Details to ${selectedUserForEmployee.name}` : 'Add New Employee - Select User'}
              </h3>
              <button onClick={handleCloseAddEmployeeModal} className="text-gray-400 hover:text-gray-600" disabled={isSaving}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
        </div>

            <div className="p-6 overflow-y-auto flex-1">
              {modalUsersError && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
                  Error: {modalUsersError} <button onClick={fetchAvailableUsers} className="ml-2 px-2 py-0.5 bg-red-500 text-white rounded text-xs">Retry</button>
                </div>
              )}
              {!selectedUserForEmployee && !editingEmployee ? (
                <div>
                  <label htmlFor="userSearch" className="block text-sm font-medium text-gray-700 mb-1">Search for user by name or email:</label>
                  <input
                    type="text"
                    id="userSearch"
                    value={userSearchTerm}
                    onChange={handleUserSearchChange}
                    placeholder="Enter name or email..."
                    className="form-input w-full mb-4"
                    disabled={modalUsersLoading || isSaving}
                  />
                  {modalUsersLoading ? (
                    <p className="text-gray-500">Loading users...</p>
                  ) : (
                    <ul className="space-y-2 max-h-80 overflow-y-auto">
                      {filteredUsersForModal.map((user) => (
                        <li 
                          key={user.internalId || user.email}
                          onClick={() => handleSelectUserFromModal(user)}
                          className={`p-3 rounded-lg cursor-pointer transition-colors hover:bg-amber-100 border border-gray-200 flex justify-between items-center`}
                        >
                          <div>
                            <p className="font-medium text-gray-800">{user.name}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                          <span className="text-xs text-gray-400">{user.role}</span>
                        </li>
                      ))}
                      {!modalUsersLoading && filteredUsersForModal.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-3">
                          {userSearchTerm ? 'No users found matching your search.' : 'No available users to add as employees.'}
                        </p>
                      )}
                    </ul>
                  )}
                </div>
              ) : (
                <div>
                  {(selectedUserForEmployee || editingEmployee) && (
                    <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium text-blue-700">
                        {editingEmployee ? "Editing Employee:" : "Selected User:"}
                      </p>
                      <p className="text-lg text-blue-800">
                        {editingEmployee ? editingEmployee.employeeName : selectedUserForEmployee!.name} 
                        <span className="text-xs"> ({editingEmployee ? editingEmployee.email : selectedUserForEmployee!.email})</span>
                      </p>
                    </div>
                  )}
                  <div className="space-y-4">
                    <FormItem label="Custom Employee ID*" error={employeeIdConflictError}>
                      <input 
                        type="text" 
                        name="employeeId" 
                        value={employeeDetails.employeeId} 
                        onChange={handleEmployeeDetailsChange} 
                        className={`form-input ${employeeIdConflictError ? 'border-red-500 ring-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                        required 
                        disabled={isSaving}
                      />
                    </FormItem>
                    <FormItem label="Position*">
                      <select name="position" value={employeeDetails.position} onChange={handleEmployeeDetailsChange} className="form-select" required disabled={isSaving}>
                        <option value="" disabled>Select position</option>
                        <option value="Manager">Manager</option>
                        <option value="Barista">Barista</option>
                        <option value="Cashier">Cashier</option>
                        <option value="Cook">Cook</option>
                        <option value="Shift Lead">Shift Lead</option>
                        <option value="Other">Other</option>
                      </select>
                    </FormItem>
                    <FormItem label="System Role*">
                      <select name="role" value={employeeDetails.role} onChange={handleEmployeeDetailsChange} className="form-select" required disabled={isSaving}>
                        <option value="employee">Employee</option>
                        <option value="cashier">Cashier</option>
                        <option value="cook">Cook</option>
                        <option value="manager">Manager</option>
                        {/* Customer role typically shouldn't be assigned here, but including for completeness if needed */}
                        {/* <option value="customer">Customer</option> */}
                      </select>
                    </FormItem>
                    <FormItem label="Phone">
                      <input type="tel" name="phone_number" value={employeeDetails.phone_number || ''} onChange={handleEmployeeDetailsChange} className="form-input" disabled={isSaving} />
                    </FormItem>
                    {(!editingEmployee || (editingEmployee && employeeDetails.hireDate !== undefined)) && (
                      <FormItem label="Hire Date (YYYY-MM-DD)">
                        <input 
                          type="date" 
                          name="hireDate" 
                          value={employeeDetails.hireDate} 
                          onChange={handleEmployeeDetailsChange} 
                          className="form-input" 
                          disabled={isSaving || !!(editingEmployee && !employeeDetails.hireDate)}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {editingEmployee ? "Leave blank if no change to hire date." : "Leave blank for today's date."}
                        </p>
                      </FormItem>
                    )}
                     <FormItem label="Status*">
                      <select name="status" value={employeeDetails.status} onChange={handleEmployeeDetailsChange} className="form-select" required disabled={isSaving}>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </FormItem>
                  </div>
                </div>
             )}
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end space-x-3">
              <button onClick={closeModal} className="form-cancel-button" disabled={isSaving}>Cancel</button>
              {(selectedUserForEmployee || editingEmployee) && (
                (() => {
                  const isFormInvalid = !!!employeeDetails.employeeId.trim() || 
                                      !!!employeeDetails.position || 
                                      employeeDetails.role === undefined; // This part is already boolean
                  
                  const nothingToSaveSelected = !!!selectedUserForEmployee && !!!editingEmployee;
                  
                  const isSaveDisabled = !!isSaving || 
                                       nothingToSaveSelected || 
                                       isFormInvalid;
                  return (
                    <button 
                      onClick={editingEmployee ? handleUpdateEmployee : handleAddEmployee} 
                      className="form-save-button" 
                      disabled={isSaveDisabled}
                    >
                      {isSaving ? 'Saving...' : (editingEmployee ? 'Save Changes' : 'Save Employee')}
                    </button>
                  );
                })()
              )}
            </div>
        </div>
    </div>
      )}
    </React.Fragment>
  );
};

interface EmployeeDetailsPanelProps {
    employee: DisplayEmployee;
    onEdit: () => void;
    onDelete: () => void;
    disabled?: boolean; 
}

const EmployeeDetailsPanel: React.FC<EmployeeDetailsPanelProps> = ({ employee: employeeProp, onEdit, onDelete, disabled }) => {
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-800">{employeeProp.employeeName}</h2>
                <div className="flex space-x-2">
                    <button onClick={onEdit} className="quick-action-button bg-yellow-100 text-yellow-700 hover:bg-yellow-200" disabled={disabled}>Edit</button>
                    <button onClick={onDelete} className="quick-action-button bg-red-100 text-red-600 hover:bg-red-200" disabled={disabled}>Delete</button>
                </div>
            </div>
            <div className="space-y-3">
                <DetailItem label="Employee ID" value={employeeProp.employeeId} />
                {employeeProp.email && <DetailItem label="Email" value={employeeProp.email} />} 
                <DetailItem label="Position" value={employeeProp.position} />
                  <DetailItem label="Status"> 
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${ 
                      employeeProp.status === 'Active' ? 'bg-green-100 text-green-700' :
                      employeeProp.status === 'Inactive' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                  }`}>
                      {employeeProp.status}
                       </span>
                  </DetailItem>
                <DetailItem label="Phone" value={employeeProp.user.phone_number || 'N/A'} />
                <DetailItem label="Hire Date" value={employeeProp.hireDate ? new Date(employeeProp.hireDate).toLocaleDateString() : 'N/A'} />
                {employeeProp.user && employeeProp.user.role && <DetailItem label="System Role" value={employeeProp.user.role} />}
             </div>
         </div>
    );
};

const DetailItem: React.FC<{ label: string; value?: string; children?: React.ReactNode }> = ({ label, value, children }) => (
  <div className="grid grid-cols-3 gap-2 items-center">
    <p className="text-sm font-medium text-gray-500 col-span-1">{label}</p>
    {children ? <div className="text-sm text-gray-800 col-span-2">{children}</div> : <p className="text-sm text-gray-800 col-span-2">{value}</p>}
    </div>
);

const FormItem: React.FC<{ label: string; children: React.ReactNode; error?: string | null }> = ({ label, children, error }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        {children}
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
);

export default Employee;

// Add this to tailwind.config.js `theme.extend.gridTemplateColumns`
// 'employee-table': 'minmax(150px, 2fr) minmax(100px, 1fr) minmax(80px, 1fr) minmax(120px, 1fr) minmax(120px, auto)', 