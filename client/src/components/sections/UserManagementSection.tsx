import { useState, useRef, useEffect } from "react";
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2, Edit2, Copy, X } from "react-feather";
import { ChevronsUpDown, ChevronDown, ChevronUp, Plus, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CustomDropdown from "../CustomDropdown";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";


type UserRole = "Administrator" | "Agent" | "Chatbot User" | "Marketer" | "Team Supervisor" | "Viewer" | "WABA Manager";
type UserStatus = "Active" | "Invited" | "Inactive";

interface Option {
  id: string;
  name: string;
}

const roleOptions: Option[] = [
  { id: "Administrator", name: "Administrator" },
  { id: "Agent", name: "Agent" },
  { id: "Chatbot User", name: "Chatbot User" },
  { id: "Marketer", name: "Marketer" },
  { id: "Team Supervisor", name: "Team Supervisor" },
  { id: "Viewer", name: "Viewer" },
  { id: "WABA Manager", name: "WABA Manager" },
];

const statusOptions: Option[] = [
  { id: "Active", name: "Active" },
  { id: "Invited", name: "Invited" },
  { id: "Inactive", name: "Inactive" },
];

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  phoneNumber: string;
}

const initialUsers: User[] = [
  {
    id: "U001",
    firstName: "Alice",
    lastName: "Johnson",
    email: "alice.j@example.com",
    role: "Administrator",
    status: "Active",
    phoneNumber: "+1-555-0101",
  },
  {
    id: "U002",
    firstName: "Bob",
    lastName: "Smith",
    email: "bob.s@example.com",
    role: "Agent",
    status: "Invited",
    phoneNumber: "+1-555-0102",
  },
  {
    id: "U003",
    firstName: "Carol",
    lastName: "White",
    email: "carol.w@example.com",
    role: "Marketer",
    status: "Inactive",
    phoneNumber: "+1-555-0103",
  },
  {
    id: "U004",
    firstName: "David",
    lastName: "Brown",
    email: "david.b@example.com",
    role: "Team Supervisor",
    status: "Active",
    phoneNumber: "+1-555-0104",
  },
  {
    id: "U005",
    firstName: "Eve",
    lastName: "Davis",
    email: "eve.d@example.com",
    role: "Agent",
    status: "Active",
    phoneNumber: "+1-555-0105",
  },
  {
    id: "U006",
    firstName: "Frank",
    lastName: "Miller",
    email: "frank.m@example.com",
    role: "Viewer",
    status: "Invited",
    phoneNumber: "+1-555-0106",
  },
  {
    id: "U007",
    firstName: "Grace",
    lastName: "Wilson",
    email: "grace.w@example.com",
    role: "Administrator",
    status: "Active",
    phoneNumber: "+1-555-0107",
  },
  {
    id: "U008",
    firstName: "Henry",
    lastName: "Moore",
    email: "henry.m@example.com",
    role: "Chatbot User",
    status: "Inactive",
    phoneNumber: "+1-555-0108",
  },
  {
    id: "U009",
    firstName: "Ivy",
    lastName: "Taylor",
    email: "ivy.t@example.com",
    role: "Marketer",
    status: "Active",
    phoneNumber: "+1-555-0109",
  },
  {
    id: "U010",
    firstName: "Jack",
    lastName: "Anderson",
    email: "jack.a@example.com",
    role: "Team Supervisor",
    status: "Invited",
    phoneNumber: "+1-555-0110",
  },
  {
    id: "U011",
    firstName: "Karen",
    lastName: "Thomas",
    email: "karen.t@example.com",
    role: "Agent",
    status: "Active",
    phoneNumber: "+1-555-0111",
  },
  {
    id: "U012",
    firstName: "Liam",
    lastName: "Jackson",
    email: "liam.j@example.com",
    role: "Viewer",
    status: "Inactive",
    phoneNumber: "+1-555-0112",
  },
  {
    id: "U013",
    firstName: "Mia",
    lastName: "White",
    email: "mia.w@example.com",
    role: "Administrator",
    status: "Active",
    phoneNumber: "+1-555-0113",
  },
  {
    id: "U014",
    firstName: "Noah",
    lastName: "Harris",
    email: "noah.h@example.com",
    role: "Chatbot User",
    status: "Invited",
    phoneNumber: "+1-555-0114",
  },
  {
    id: "U015",
    firstName: "Olivia",
    lastName: "Martin",
    email: "olivia.m@example.com",
    role: "Marketer",
    status: "Active",
    phoneNumber: "+1-555-0115",
  },
  {
    id: "U016",
    firstName: "Peter",
    lastName: "Garcia",
    email: "peter.g@example.com",
    role: "Team Supervisor",
    status: "Active",
    phoneNumber: "+1-555-0116",
  },
  {
    id: "U017",
    firstName: "Quinn",
    lastName: "Rodriguez",
    email: "quinn.r@example.com",
    role: "Agent",
    status: "Invited",
    phoneNumber: "+1-555-0117",
  },
  {
    id: "U018",
    firstName: "Rachel",
    lastName: "Martinez",
    email: "rachel.m@example.com",
    role: "Viewer",
    status: "Inactive",
    phoneNumber: "+1-555-0118",
  },
  {
    id: "U019",
    firstName: "Sam",
    lastName: "Hernandez",
    email: "sam.h@example.com",
    role: "Administrator",
    status: "Active",
    phoneNumber: "+1-555-0119",
  },
];

export default function UserManagementSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch workspace members
  const { data: membersData, isLoading: isLoadingMembers } = useQuery({
    queryKey: ["/api/workspaces/members"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/workspaces/members");
      return res.json();
    }
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/workspaces/members", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t("user_management_section.toast_user_invited_title"),
        description: t("user_management_section.toast_invite_sent_desc"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/members"] });
      setShowCreateUserModal(false);
      // Reset form
      setNewFirstName("");
      setNewLastName("");
      setNewEmail("");
      setNewRole("Agent");
      setNewPhoneNumber("");
    },
    onError: (err: Error) => {
      toast({
        title: t("user_management_section.toast_invite_failed_title"),
        description: err.message,
        variant: "destructive",
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/workspaces/members/${id}`);
    },
    onSuccess: () => {
      toast({
        title: t("user_management_section.toast_user_removed_title"),
        description: t("user_management_section.toast_user_removed_desc"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/members"] });
      setShowDeleteUserModal(false);
      setUserToDelete(null);
    },
    onError: (err: Error) => {
      toast({
        title: t("user_management_section.toast_remove_failed_title"),
        description: err.message,
        variant: "destructive",
      });
    }
  });

  const users = useMemo(() => {
    if (!membersData) return [];
    return (membersData as any[]).map((m: any) => ({
      id: m.id.toString(),
      firstName: m.users?.first_name || "Unknown",
      lastName: m.users?.last_name || "",
      email: m.users?.email || "",
      role: (m.roles?.name || "Agent") as UserRole,
      status: (m.users?.status?.charAt(0) + m.users?.status?.slice(1).toLowerCase() || "Active") as UserStatus,
      phoneNumber: m.users?.phoneNumber || "-",
    }));
  }, [membersData]);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sort, setSort] = useState<{ column: string; direction: "asc" | "desc" } | null>(null);
  const [filterRole, setFilterRole] = useState<UserRole[]>([]);
  const [filterStatus, setFilterStatus] = useState<UserStatus[]>([]);
  const [isInvitedUserEditing, setIsInvitedUserEditing] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const [rowsDropdownOpen, setRowsDropdownOpen] = useState(false);

  // Create User Modal State
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("Agent"); // Default role
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [newCountryCode, setNewCountryCode] = useState("+1");

  // Edit User Modal State
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFullName, setEditFullName] = useState(""); // Uneditable
  const [editEmail, setEditEmail] = useState(""); // Uneditable
  const [editRole, setEditRole] = useState<UserRole>("Agent");
  const [editStatus, setEditStatus] = useState<UserStatus>("Active");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [editCountryCode, setEditCountryCode] = useState("+1");

  // Delete User Modal State
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Bulk Delete Modal State
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const handleColumnSort = (column: string) => {
    if (sort?.column === column) {
      if (sort.direction === "asc") {
        setSort({ column, direction: "desc" });
      } else {
        setSort(null); // Unsort
      }
    } else {
      setSort({ column, direction: "asc" });
    }
  };

  const renderSortIcon = (column: string) => {
    const isActive = sort?.column === column;
    const color = isActive ? "text-foreground" : "text-muted-foreground";

    if (!isActive) {
      return <div className="w-4 h-4 flex items-center justify-center"><ChevronsUpDown size={14} className={color} /></div>;
    }
    if (sort?.direction === "asc") {
      return <div className="w-4 h-4 flex items-center justify-center"><ChevronUp size={14} className={color} /></div>;
    }
    return <div className="w-4 h-4 flex items-center justify-center"><ChevronDown size={14} className={color} /></div>;
  };

  const getFilteredAndSortedData = () => {
    let data = [...users];

    // Apply search
    if (search) {
      data = data.filter(user =>
        user.firstName.toLowerCase().includes(search.toLowerCase()) ||
        user.lastName.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase()) ||
        user.phoneNumber.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply role filter
    if (filterRole.length > 0) {
      data = data.filter(user => filterRole.includes(user.role));
    }

    // Apply status filter
    if (filterStatus.length > 0) {
      data = data.filter(user => filterStatus.includes(user.status));
    }

    // Apply sorting
    if (sort) {
      data.sort((a, b) => {
        const aVal = a[sort.column as keyof User];
        const bVal = b[sort.column as keyof User];

        let comparison = 0;

        // Custom sort order for status
        if (sort.column === "status") {
          const statusOrder: Record<UserStatus, number> = {
            "Active": 0,
            "Invited": 1,
            "Inactive": 2,
          };
          comparison = statusOrder[aVal as UserStatus] - statusOrder[bVal as UserStatus];
        } else if (typeof aVal === "string" && typeof bVal === "string") {
          comparison = aVal.localeCompare(bVal);
        } else if (typeof aVal === "number" && typeof bVal === "number") {
          comparison = aVal - bVal;
        }

        return sort.direction === "asc" ? comparison : -comparison;
      });
    }

    // Apply pagination
    const startIndex = (page - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const totalFilteredUsers = () => {
    let data = [...users];

    // Apply search
    if (search) {
      data = data.filter(user =>
        user.firstName.toLowerCase().includes(search.toLowerCase()) ||
        user.lastName.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase()) ||
        user.phoneNumber.toLowerCase().includes(search.toLowerCase())
      );
    }
    // Apply role filter
    if (filterRole.length > 0) {
      data = data.filter(user => filterRole.includes(user.role));
    }

    // Apply status filter
    if (filterStatus.length > 0) {
      data = data.filter(user => filterStatus.includes(user.status));
    }
    return data.length;
  };





  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditFullName(`${user.firstName} ${user.lastName}`);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditPhoneNumber(user.phoneNumber.replace(/^\+\d+-/, '')); // Remove country code for editing
    setEditCountryCode(user.phoneNumber.match(/^\+(\d+)-/)?.[1] ? `+${user.phoneNumber.match(/^\+(\d+)-/)?.[1]}` : "+1"); // Extract country code without hyphen
    setIsInvitedUserEditing(user.status === "Invited");
    setShowEditUserModal(true);
  };

  const handleCopyUser = (user: User) => {
    const userText = `${user.firstName} ${user.lastName} - ${user.email} - ${user.phoneNumber}`;
    navigator.clipboard.writeText(userText);
    toast({
      title: t("user_management_section.toast_copied_title"),
      description: userText,
    });
  };

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setShowDeleteUserModal(true);
  };

  const handleConfirmDelete = () => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete.id);
    }
  };





  const handleInviteUser = () => {
    if (!newFirstName.trim() || !newLastName.trim() || !newEmail.trim()) {
      toast({
        title: t("user_management_section.toast_missing_fields_title"),
        description: t("user_management_section.toast_missing_fields_desc"),
        variant: "destructive",
      });
      return;
    }
    inviteMutation.mutate({
      email: newEmail,
      first_name: newFirstName,
      last_name: newLastName,
      role_id: 1, // Default to 1 for now, should map from roleOptions
    });
  };

  const handleSaveEditUser = () => {
    if (!editRole || !editStatus || !editPhoneNumber.trim()) {
      toast({
        title: t("user_management_section.toast_missing_fields_title"),
        description: t("user_management_section.toast_missing_fields_desc"),
        variant: "destructive",
      });
      return;
    }
    if (editingUser) {
      // setUsers(
      //   users.map(u =>
      //     u.id === editingUser.id
      //       ? {
      //         ...u,
      //         role: editRole,
      //         status: editStatus,
      //         phoneNumber: `${editCountryCode}-${editPhoneNumber}`,
      //       }
      //       : u
      //   )
      // );
      toast({
        title: t("user_management_section.toast_user_updated_title"),
        description: t("user_management_section.toast_user_updated_desc", { name: `${editingUser.firstName} ${editingUser.lastName}` }),
      });
      setShowEditUserModal(false);
      setEditingUser(null);
      setEditFullName("");
      setEditEmail("");
      setEditRole("Agent");
      setEditStatus("Active");
      setEditPhoneNumber("");
      setEditCountryCode("+1");
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setRowsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Section - Outside Card */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("user_management_section.page_title")}</h1>
        <Button
          onClick={() => setShowCreateUserModal(true)}
          className="btn-outline-primary gap-2 h-9 font-normal"
          variant="outline"
        >
          <Plus size={16} />
          {t("user_management_section.create_user_button")}
        </Button>
      </div>

      {/* Search Section */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs" style={{ height: "38px" }}>
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type="text"
            placeholder={t("user_management_section.search_placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 text-sm w-full h-full border border-input rounded-md bg-background focus:outline-none transition-colors"
          />
        </div>
        <CustomDropdown
          options={roleOptions}
          selected={filterRole}
          onChange={(selectedIds) => setFilterRole(selectedIds as UserRole[])}
          placeholder={t("user_management_section.filter_role_placeholder")}
          width="190px"
        />
        <CustomDropdown
          options={statusOptions}
          selected={filterStatus}
          onChange={(selectedIds) => setFilterStatus(selectedIds as UserStatus[])}
          placeholder={t("user_management_section.filter_status_placeholder")}
          width="120px"
        />
      </div>

      {/* Table Card */}
      <Card className="shadow-[0_-3px_6px_rgba(0,0,0,0.04),-3px_0_6px_rgba(0,0,0,0.04),3px_0_6px_rgba(0,0,0,0.04),0_4px_6px_rgba(0,0,0,0.1)] border-0">
        <CardContent className="pt-2">


          {/* Table */}
          <div className="overflow-x-auto mt-6">
            <table className="w-full text-xs">
              <thead className="select-none">
                <tr className="border-b">

                  <th
                    className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30"
                    onClick={() => handleColumnSort("firstName")}
                  >
                    <div className="flex items-center gap-2">
                      {t("user_management_section.column_name")}
                      {renderSortIcon("firstName")}
                    </div>
                  </th>
                  <th
                    className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30"
                    onClick={() => handleColumnSort("email")}
                  >
                    <div className="flex items-center gap-2">
                      {t("user_management_section.column_email")}
                      {renderSortIcon("email")}
                    </div>
                  </th>
                  <th
                    className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30"
                    onClick={() => handleColumnSort("role")}
                  >
                    <div className="flex items-center gap-2">
                      {t("user_management_section.column_role")}
                      {renderSortIcon("role")}
                    </div>
                  </th>
                  <th
                    className="text-left py-2 px-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/30"
                    onClick={() => handleColumnSort("status")}
                  >
                    <div className="flex items-center gap-2">
                      {t("user_management_section.column_status")}
                      {renderSortIcon("status")}
                    </div>
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t("user_management_section.column_actions")}</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingMembers ? (
                  <tr>
                    <td colSpan={5} className="text-center py-20">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
                    </td>
                  </tr>
                ) : getFilteredAndSortedData().length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      {t("user_management_section.no_users_found")}
                    </td>
                  </tr>
                ) : (
                  getFilteredAndSortedData().map((user) => (
                    <tr key={user.id} className="border-b hover:bg-muted/50">

                      <td className="py-2 px-3">{user.firstName} {user.lastName}</td>
                      <td className="py-2 px-3">{user.email}</td>
                      <td className="py-2 px-3">{user.role}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${user.status === "Active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                          user.status === "Invited" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" :
                            "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1 hover:bg-muted rounded">
                                <MoreVertical size={14} className="text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white dark:bg-background">
                              <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                <Edit2 size={14} className="mr-2" />
                                {t("user_management_section.action_edit")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCopyUser(user)}>
                                <Copy size={14} className="mr-2" />
                                {t("user_management_section.action_copy")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteUser(user)} className="text-destructive">
                                <Trash2 size={14} className="mr-2" />
                                {t("user_management_section.action_delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-xs">
            <span className="text-muted-foreground">{t("user_management_section.results_count", { count: totalFilteredUsers() })}</span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{t("user_management_section.rows_per_page_label")}</span>
              <div className="relative w-15" ref={dropdownRef}>
                <button
                  type="button"
                  className="flex items-center justify-between px-3 py-2 text-left bg-background border border-input rounded-md shadow-sm hover:bg-accent focus:outline-none text-foreground transition-colors"
                  onClick={() => setRowsDropdownOpen(!rowsDropdownOpen)}
                >
                  <span className="truncate text-xs font-normal">{rowsPerPage}</span>
                  <ChevronDown className="h-3 w-3 ml-2 text-muted-foreground" />
                </button>
                {rowsDropdownOpen && (
                  <div className="absolute z-10 w-full mt-2 bg-background rounded-md shadow-md border border-border">
                    <ul className="py-1">
                      {[10, 25, 50].map(option => (
                        <li
                          key={option}
                          className="px-3 py-2 text-xs cursor-pointer hover:bg-muted"
                          onClick={() => {
                            setRowsPerPage(option);
                            setPage(1); // Reset to first page when rows per page changes
                            setRowsDropdownOpen(false);
                          }}
                        >
                          {option}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <span className="text-muted-foreground">{t("user_management_section.page_of_label", { page, totalPages: Math.ceil(totalFilteredUsers() / rowsPerPage) })}</span>
              <div className="flex gap-1">
                <button
                  className="p-1 hover:bg-muted rounded disabled:opacity-50"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  className="p-1 hover:bg-muted rounded disabled:opacity-50"
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="p-1 hover:bg-muted rounded disabled:opacity-50"
                  onClick={() => setPage(prev => Math.min(Math.ceil(totalFilteredUsers() / rowsPerPage), prev + 1))}
                  disabled={page === Math.ceil(totalFilteredUsers() / rowsPerPage)}
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  className="p-1 hover:bg-muted rounded disabled:opacity-50"
                  onClick={() => setPage(Math.ceil(totalFilteredUsers() / rowsPerPage))}
                  disabled={page === Math.ceil(totalFilteredUsers() / rowsPerPage)}
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create User Modal */}
      <Dialog open={showCreateUserModal} onOpenChange={setShowCreateUserModal}>
        <DialogContent className="max-w-md">
          <DialogHeader className="mb-2">
            <DialogTitle>{t("user_management_section.create_user_modal_title")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* First Name Input */}
            <div>
              <label className="text-sm font-medium text-foreground">{t("user_management_section.first_name_label")}<span className="text-red-500 pl-0.5">*</span></label>
              <Input
                placeholder={t("user_management_section.first_name_placeholder")}
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
              />
            </div>

            {/* Last Name Input */}
            <div>
              <label className="text-sm font-medium text-foreground">{t("user_management_section.last_name_label")}<span className="text-red-500 pl-0.5">*</span></label>
              <Input
                placeholder={t("user_management_section.last_name_placeholder")}
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
              />
            </div>

            {/* Email Input */}
            <div>
              <label className="text-sm font-medium text-foreground">{t("user_management_section.email_label")}<span className="text-red-500 pl-0.5">*</span></label>
              <Input
                type="email"
                placeholder={t("user_management_section.email_placeholder")}
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>

            {/* Role Select */}
            <div>
              <label className="text-sm font-medium text-foreground">{t("user_management_section.role_label")}<span className="text-red-500 pl-0.5">*</span></label>
              <Select value={newRole} onValueChange={(value: UserRole) => setNewRole(value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("user_management_section.role_select_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Administrator">Administrator</SelectItem>
                  <SelectItem value="Agent">Agent</SelectItem>
                  <SelectItem value="Chatbot User">Chatbot User</SelectItem>
                  <SelectItem value="Marketer">Marketer</SelectItem>
                  <SelectItem value="Team Supervisor">Team Supervisor</SelectItem>
                  <SelectItem value="Viewer">Viewer</SelectItem>
                  <SelectItem value="WABA Manager">WABA Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Phone Number Input with Country Code */}
            <div>
              <label className="text-sm font-medium text-foreground">{t("user_management_section.phone_number_label")}<span className="text-red-500 pl-0.5">*</span></label>
              <div className="flex gap-2">
                <Select value={newCountryCode} onValueChange={setNewCountryCode}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="+1" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="+1">+1 (US)</SelectItem>
                    <SelectItem value="+44">+44 (UK)</SelectItem>
                    <SelectItem value="+91">+91 (IN)</SelectItem>
                    <SelectItem value="+61">+61 (AU)</SelectItem>
                    <SelectItem value="+81">+81 (JP)</SelectItem>
                    <SelectItem value="+49">+49 (DE)</SelectItem>
                    <SelectItem value="+33">+33 (FR)</SelectItem>
                    <SelectItem value="+86">+86 (CN)</SelectItem>
                    <SelectItem value="+55">+55 (BR)</SelectItem>
                    <SelectItem value="+27">+27 (ZA)</SelectItem>
                    {/* Add more country codes as needed */}
                  </SelectContent>
                </Select>
                <Input
                  type="tel"
                  placeholder={t("user_management_section.phone_number_placeholder")}
                  value={newPhoneNumber}
                  onChange={(e) => setNewPhoneNumber(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex gap-2 justify-end mt-2">
            <Button
              onClick={() => setShowCreateUserModal(false)}
              variant="outline"
              className="border-input [border-color:hsl(var(--input))] font-normal"
            >
              {t("user_management_section.cancel_button")}
            </Button>
            <Button
              onClick={handleInviteUser}
              className="btn-outline-primary font-normal"
              variant="outline"
            >
              {t("user_management_section.invite_user_button")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Edit User Modal */}
      <Dialog open={showEditUserModal} onOpenChange={setShowEditUserModal}>
        <DialogContent className="max-w-md">
          <DialogHeader className="mb-2">
            <DialogTitle>{t("user_management_section.edit_user_modal_title")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Full Name Input (Uneditable) */}
            <div>
              <label className="text-sm font-medium text-foreground">{t("user_management_section.full_name_label")}</label>
              <Input value={editFullName} disabled />
            </div>

            {/* Email Input (Uneditable) */}
            <div>
              <label className="text-sm font-medium text-foreground">{t("user_management_section.email_label")}</label>
              <Input value={editEmail} disabled />
            </div>

            {/* Role Select */}
            <div>
              <label className="text-sm font-medium text-foreground">{t("user_management_section.role_label")}<span className="text-red-500 pl-0.5">*</span></label>
              <Select value={editRole} onValueChange={(value: UserRole) => setEditRole(value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("user_management_section.role_select_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Administrator">Administrator</SelectItem>
                  <SelectItem value="Agent">Agent</SelectItem>
                  <SelectItem value="Chatbot User">Chatbot User</SelectItem>
                  <SelectItem value="Marketer">Marketer</SelectItem>
                  <SelectItem value="Team Supervisor">Team Supervisor</SelectItem>
                  <SelectItem value="Viewer">Viewer</SelectItem>
                  <SelectItem value="WABA Manager">WABA Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Select */}
            <div>
              <label className="text-sm font-medium text-foreground">{t("user_management_section.status_label")}{isInvitedUserEditing ? null : <span className="text-red-500 pl-0.5">*</span>}</label>
              <Select value={editStatus} onValueChange={(value: UserStatus) => setEditStatus(value)} disabled={isInvitedUserEditing}>
                <SelectTrigger>
                  <SelectValue placeholder={t("user_management_section.status_select_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  {isInvitedUserEditing && <SelectItem value="Invited">Invited</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {/* Phone Number Input with Country Code */}
            <div>
              <label className="text-sm font-medium text-foreground">{t("user_management_section.phone_number_label")}{isInvitedUserEditing ? null : <span className="text-red-500 pl-0.5">*</span>}</label>
              <div className="flex gap-2">
                <Select value={editCountryCode} onValueChange={setEditCountryCode} disabled={isInvitedUserEditing}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="+1" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="+1">+1 (US)</SelectItem>
                    <SelectItem value="+44">+44 (UK)</SelectItem>
                    <SelectItem value="+91">+91 (IN)</SelectItem>
                    <SelectItem value="+61">+61 (AU)</SelectItem>
                    <SelectItem value="+81">+81 (JP)</SelectItem>
                    <SelectItem value="+49">+49 (DE)</SelectItem>
                    <SelectItem value="+33">+33 (FR)</SelectItem>
                    <SelectItem value="+86">+86 (CN)</SelectItem>
                    <SelectItem value="+55">+55 (BR)</SelectItem>
                    <SelectItem value="+27">+27 (ZA)</SelectItem>
                    {/* Add more country codes as needed */}
                  </SelectContent>
                </Select>
                <Input
                  type="tel"
                  placeholder={t("user_management_section.phone_number_placeholder")}
                  value={editPhoneNumber}
                  onChange={(e) => setEditPhoneNumber(e.target.value)}
                  className="flex-1"
                  disabled={isInvitedUserEditing}
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex gap-2 justify-end mt-2">
            <Button
              onClick={() => setShowEditUserModal(false)}
              variant="outline"
              className="border-input [border-color:hsl(var(--input))] font-normal"
            >
              {t("user_management_section.cancel_button")}
            </Button>
            <Button
              onClick={handleSaveEditUser}
              className="btn-outline-primary font-normal"
              variant="outline"
            >
              {t("user_management_section.save_button")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Delete User Modal */}
      <Dialog open={showDeleteUserModal} onOpenChange={setShowDeleteUserModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="mb-2">
            <DialogTitle>{t("user_management_section.delete_user_modal_title")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-foreground">
              {t("user_management_section.delete_confirm_prefix")} <span className="font-semibold break-all">{userToDelete?.firstName} {userToDelete?.lastName}</span>{t("user_management_section.delete_confirm_suffix")}
            </p>
          </div>

          {/* Modal Footer */}
          <div className="flex gap-2 justify-end mt-2">
            <Button
              onClick={() => setShowDeleteUserModal(false)}
              variant="outline"
              className="border-input [border-color:hsl(var(--input))]"
            >
              {t("user_management_section.cancel_button")}
            </Button>
            <Button
              onClick={handleConfirmDelete}
              className="btn-outline-destructive"
              variant="outline"
            >
              {t("user_management_section.action_delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>



    </div>
  );
}
