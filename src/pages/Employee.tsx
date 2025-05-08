import React, { useState } from 'react';
import { EmployeeData } from '../types'; // Import EmployeeData

// Define interface for Employee data
// interface EmployeeData { ... }

// Sample Employee Data (Ensure it matches the imported EmployeeData structure)
const sampleEmployees: EmployeeData[] = [
  { id: 'emp-1', employeeId: '65f4ca94a', employeeName: 'Zsanpeter Serra', position: 'Barista', status: 'Active', email: 'z.serra@email.com', hireDate: '2022-08-15' },
  { id: 'emp-2', employeeId: 'afd54e654d', employeeName: 'Jane Doe', position: 'Barista', status: 'Active', email: 'j.doe@email.com', hireDate: '2023-01-20' },
  { id: 'emp-3', employeeId: '0912345678', employeeName: 'John Smith', position: 'Cashier', status: 'Inactive', email: 'j.smith@email.com', hireDate: '2023-03-10' },
  { id: 'emp-4', employeeId: '1122334455', employeeName: 'Alice Brown', position: 'Cook', status: 'Active', email: 'a.brown@email.com', hireDate: '2023-05-01' },
  { id: 'emp-5', employeeId: '9876543210', employeeName: 'Bob White', position: 'Barista', status: 'On Leave', email: 'b.white@email.com', hireDate: '2023-07-11' },
  // Add more employees...
];

const Employee: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeData[]>(sampleEmployees);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Filter employees based on search term
  const filteredEmployees = employees.filter(emp => 
      emp.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle selecting an employee from the list
  const handleSelectEmployee = (employee: EmployeeData) => {
      setSelectedEmployee(employee);
      setIsAdding(false);
      setIsEditing(false);
  };

  // --- Actions handled in the right panel ---
  const handleEditClick = () => {
      setIsEditing(true);
      setIsAdding(false); // Ensure not in adding mode
       // Form should be pre-filled with selectedEmployee data
  };

  const handleSaveEdit = (updatedEmployeeData: EmployeeData | Omit<EmployeeData, 'id'>) => {
      // When handleSaveEdit is called, it's in an editing context, so id should exist.
      // We assert this or handle it gracefully.
      if (!('id' in updatedEmployeeData) || !updatedEmployeeData.id) {
          console.error("handleSaveEdit called without a full EmployeeData object including id.");
          return; // Or throw an error
      }
      const updatedEmployee = updatedEmployeeData as EmployeeData; // Cast to EmployeeData after check

      console.log("Saving edited employee:", updatedEmployee);
      setEmployees(prev => prev.map(emp => emp.id === updatedEmployee.id ? updatedEmployee : emp));
      setSelectedEmployee(updatedEmployee);
      setIsEditing(false);
  };

  const handleDelete = () => {
      if (!selectedEmployee) return;
       console.log("Delete employee:", selectedEmployee.employeeId);
      // TODO: Implement delete confirmation and actual delete logic (API call, etc.)
       if (window.confirm(`Are you sure you want to delete ${selectedEmployee.employeeName}?`)) {
            setEmployees(prev => prev.filter(emp => emp.id !== selectedEmployee.id)); 
            setSelectedEmployee(null); // Clear selection
            setIsEditing(false);
            setIsAdding(false);
       }
  };

  const handleAddEmployeeClick = () => {
      setSelectedEmployee(null); // Clear selection
      setIsAdding(true);
      setIsEditing(false);
       // Form in right panel should be cleared for new entry
  };

  const handleSaveNewEmployee = (newEmployeeData: Omit<EmployeeData, 'id'>) => {
       console.log("Saving new employee:", newEmployeeData);
       const newEmployeeWithId: EmployeeData = {
           ...newEmployeeData,
           id: Date.now().toString(), // Temporary ID generation
       };
       setEmployees(prev => [newEmployeeWithId, ...prev]);
       setSelectedEmployee(newEmployeeWithId);
       setIsAdding(false);
  };

   const handleCancel = () => {
       setIsAdding(false);
       setIsEditing(false);
        // If an employee was selected before clicking add/edit, re-select them
        // Or simply clear selection: setSelectedEmployee(null);
   };

  return (
    <div className="flex gap-6 h-[calc(100vh-theme(space.24))]"> {/* Adjust height */}
        {/* Main Content Area - Employee List */}
        <div className="flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-semibold text-brown-900">Manage Employees</h1>
                <div className="flex items-center space-x-4">
                    <div className="relative w-64">
                        <input 
                            type="text" 
                            placeholder="Enter employee ID or Name" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brown-400 text-sm"
                        />
                        <img src="/src/assets/search.svg" alt="Search" className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                     </div>
                     <button 
                          onClick={handleAddEmployeeClick}
                          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-blue-700 transition-colors">
                         <img src="/src/assets/add.svg" alt="" className="w-4 h-4" />
                         Add Employee
                     </button>
                 </div>
            </div>

          {/* Employee List */}
            <div className="bg-white rounded-2xl shadow border border-gray-100 flex-1 overflow-y-auto">
                 <div className="divide-y divide-gray-100">
                    {filteredEmployees.length > 0 ? filteredEmployees.map((employee) => (
                        <button 
                            key={employee.id} 
                            onClick={() => handleSelectEmployee(employee)}
                            className={`w-full text-left px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors ${selectedEmployee?.id === employee.id ? 'bg-blue-50' : ''}`}>
                               {/* Placeholder Avatar */}
                               <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-lg font-medium">
                                   {employee.employeeName.charAt(0).toUpperCase()}
                               </div>
                               <div className="flex-1">
                                  <span className={`font-medium ${selectedEmployee?.id === employee.id ? 'text-blue-800' : 'text-gray-900'}`}>{employee.employeeName}</span>
                                  <p className="text-sm text-gray-500">{employee.position} • ID: {employee.employeeId}</p>
                               </div>
                               <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${employee.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                 {employee.status}
                               </span>
                        </button>
                    )) : (
                     <div className="text-center py-10 text-gray-500 col-span-full">
                        No employees found{searchTerm ? ` matching "${searchTerm}"` : ''}.
                     </div>
                    )} 
                 </div>
            </div>
        </div>

        {/* Right Panel - Details / Edit / Add Form */}
        <div className="w-96 bg-white rounded-2xl p-5 shadow border border-gray-100 flex flex-col">
            {selectedEmployee && !isEditing && !isAdding && (
                <EmployeeDetailsPanel 
                    employee={selectedEmployee} 
                    onEdit={handleEditClick} 
                    onDelete={handleDelete} 
                />
            )}
            {(isEditing || isAdding) && (
                <EmployeeFormPanel 
                    initialData={isEditing ? selectedEmployee : null} 
                    isAdding={isAdding}
                    onSave={isAdding ? handleSaveNewEmployee : handleSaveEdit}
                    onCancel={handleCancel}
                />
            )}
             {!selectedEmployee && !isEditing && !isAdding && (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400">
                    <img src="/src/assets/employee.svg" alt="" className="w-20 h-20 mb-4 opacity-50" />
                    <p>Select an employee from the list to view their details or click 'Add Employee' to create a new one.</p>
                </div>
             )}
        </div>
    </div>
  );
};

// --- Right Panel Components ---

interface EmployeeDetailsPanelProps {
    employee: EmployeeData;
    onEdit: () => void;
    onDelete: () => void;
}

const EmployeeDetailsPanel: React.FC<EmployeeDetailsPanelProps> = ({ employee, onEdit, onDelete }) => {
    return (
         <div className="flex flex-col h-full">
             <h2 className="text-xl font-semibold text-brown-800 mb-4">Employee Details</h2>
              <div className="flex-1 space-y-3 overflow-y-auto pr-1 mb-4 text-sm">
                  <DetailItem label="Employee Name" value={employee.employeeName} />
                  <DetailItem label="Position" value={employee.position} />
                  <DetailItem label="Status"> 
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${employee.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                           {employee.status}
                       </span>
                  </DetailItem>
                  <DetailItem label="Employee ID" value={employee.employeeId} />
                  {employee.email && <DetailItem label="Email" value={employee.email} />}
                  {employee.hireDate && <DetailItem label="Hire Date" value={employee.hireDate} />}
             </div>
             <div className="mt-auto pt-4 border-t border-gray-100 flex space-x-3">
                 <button onClick={onEdit} className="flex-1 px-4 py-2 bg-blue-100 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-200 transition-colors flex items-center justify-center gap-2">
                     <img src="/src/assets/edit.svg" alt="Edit" className="w-4 h-4" /> Edit
                 </button>
                  <button onClick={onDelete} className="flex-1 px-4 py-2 bg-red-100 text-red-700 rounded-xl text-sm font-medium hover:bg-red-200 transition-colors flex items-center justify-center gap-2">
                      <img src="/src/assets/delete.svg" alt="Delete" className="w-4 h-4" /> Delete
                  </button>
             </div>
         </div>
    );
};

interface EmployeeFormPanelProps {
    initialData: EmployeeData | null;
    isAdding: boolean;
    onSave: (data: EmployeeData | Omit<EmployeeData, 'id'>) => void;
    onCancel: () => void;
}

const EmployeeFormPanel: React.FC<EmployeeFormPanelProps> = ({ initialData, isAdding, onSave, onCancel }) => {
    const [formData, setFormData] = useState<Omit<EmployeeData, 'id'> | EmployeeData>(() => {
        if (initialData) {
            return initialData;
        }
        return {
            employeeName: '',
            position: 'Barista',
            status: 'Active',
            employeeId: '',
            email: '',
            phone: '',
            hireDate: '',
        };
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

     const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData); 
    };

    const positionOptions: EmployeeData['position'][] = ['Manager', 'Barista', 'Cashier', 'Cook', 'Shift Lead', 'Other'];
    const statusOptions: EmployeeData['status'][] = ['Active', 'Inactive', 'On Leave'];

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <h2 className="text-xl font-semibold text-brown-800 mb-6">
                {isAdding ? 'Add New Employee' : 'Edit Employee'}
            </h2>
            <div className="flex-1 space-y-4 overflow-y-auto pr-1 mb-4">
                <FormItem label="Employee Name">
                    <input type="text" name="employeeName" value={formData.employeeName} onChange={handleInputChange} className="form-input" required />
                </FormItem>
                <FormItem label="Position">
                    <select name="position" value={formData.position} onChange={handleInputChange} className="form-select">
                        {positionOptions.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                    </select>
                </FormItem>
                <FormItem label="Status">
                     <select name="status" value={formData.status} onChange={handleInputChange} className="form-select">
                        {statusOptions.map(stat => <option key={stat} value={stat}>{stat}</option>)}
                    </select>
                </FormItem>
                <FormItem label="Employee ID (System/Assigned)">
                    <input type="text" name="employeeId" value={formData.employeeId} onChange={handleInputChange} className="form-input" required />
                </FormItem>
                <FormItem label="Email">
                    <input type="email" name="email" value={formData.email || ''} onChange={handleInputChange} className="form-input" />
                </FormItem>
                <FormItem label="Phone">
                    <input type="tel" name="phone" value={formData.phone || ''} onChange={handleInputChange} className="form-input" />
                </FormItem>
                 <FormItem label="Hire Date">
                    <input type="date" name="hireDate" value={formData.hireDate || ''} onChange={handleInputChange} className="form-input" />
                </FormItem>
            </div>
            <div className="mt-auto pt-4 border-t border-gray-100 flex space-x-3">
                <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">
                    Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors">
                    {isAdding ? 'Add Employee' : 'Save Changes'}
                </button>
            </div>
        </form>
    );
};

// Helper components for details and forms
const DetailItem: React.FC<{ label: string; value?: string; children?: React.ReactNode }> = ({ label, value, children }) => (
    <div>
        <label className="block text-xs font-medium text-gray-500 mb-0.5">{label}</label>
        {value && <p className="text-gray-800">{value}</p>}
        {children}
    </div>
);

const FormItem: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        {children}
    </div>
);

// Define common input styles in index.css or use Tailwind directly if preferred:
// .form-input { @apply w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brown-400 text-sm; }
// .form-select { @apply w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brown-400 text-sm bg-white; }

export default Employee;

// Add this to tailwind.config.js `theme.extend.gridTemplateColumns`
// 'employee-table': 'minmax(150px, 2fr) minmax(100px, 1fr) minmax(80px, 1fr) minmax(120px, 1fr) minmax(120px, auto)', 