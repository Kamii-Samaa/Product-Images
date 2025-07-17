"use server"

import { createClient } from "@/lib/supabase/server"
import type { UserRole } from "@/types/file-system"

// Helper to get user session and check roles
async function getUserSessionAndRoles() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new Error("Unauthorized: No active session.")
  }

  const { data: rolesData, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)

  if (rolesError) {
    console.error("Error fetching user roles:", rolesError.message)
    throw new Error("Failed to fetch user roles.")
  }

  const roles = rolesData ? rolesData.map((r) => r.role) : []
  return { session, roles }
}

export async function getUsers(): Promise<{
  success: boolean
  users?: Array<{ id: string; email: string; roles: string[] }>
  error?: string
}> {
  try {
    const { roles } = await getUserSessionAndRoles()
    if (!roles.includes("admin")) {
      return { success: false, error: "Forbidden: Only admins can view users." }
    }

    const supabase = createClient()

    // Fetch users from auth.users table
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      console.error("Error listing auth users:", authError.message)
      return { success: false, error: "Failed to fetch users." }
    }

    const userIds = authUsers.users.map((u) => u.id)

    // Fetch roles for these users
    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds)

    if (rolesError) {
      console.error("Error fetching user roles:", rolesError.message)
      return { success: false, error: "Failed to fetch user roles." }
    }

    const rolesMap = new Map<string, string[]>()
    userRoles.forEach((ur) => {
      if (!rolesMap.has(ur.user_id)) {
        rolesMap.set(ur.user_id, [])
      }
      rolesMap.get(ur.user_id)?.push(ur.role)
    })

    const usersWithRoles = authUsers.users.map((user) => ({
      id: user.id,
      email: user.email || "N/A",
      roles: rolesMap.get(user.id) || [],
    }))

    return { success: true, users: usersWithRoles }
  } catch (e: any) {
    console.error("Server action error (getUsers):", e.message)
    return { success: false, error: e.message || "An unexpected error occurred." }
  }
}

export async function addUser(
  email: string,
  role: UserRole,
): Promise<{ success: boolean; user?: { id: string; email: string }; error?: string }> {
  try {
    const { roles } = await getUserSessionAndRoles()
    if (!roles.includes("admin")) {
      return { success: false, error: "Forbidden: Only admins can add users." }
    }

    const supabase = createClient()

    // Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: Math.random().toString(36).substring(2, 15), // Temporary password, user will set it
      email_confirm: true, // Send confirmation email
    })

    if (authError) {
      console.error("Error creating auth user:", authError.message)
      return { success: false, error: authError.message || "Failed to create user." }
    }

    // Assign role
    const { error: roleError } = await supabase.from("user_roles").insert({ user_id: authUser.user.id, role })

    if (roleError) {
      console.error("Error assigning role:", roleError.message)
      // Clean up auth user if role assignment fails
      await supabase.auth.admin.deleteUser(authUser.user.id)
      return { success: false, error: "Failed to assign role to user." }
    }

    return { success: true, user: { id: authUser.user.id, email: authUser.user.email! } }
  } catch (e: any) {
    console.error("Server action error (addUser):", e.message)
    return { success: false, error: e.message || "An unexpected error occurred." }
  }
}

export async function updateUserRole(userId: string, newRole: UserRole): Promise<{ success: boolean; error?: string }> {
  try {
    const { roles } = await getUserSessionAndRoles()
    if (!roles.includes("admin")) {
      return { success: false, error: "Forbidden: Only admins can update user roles." }
    }

    const supabase = createClient()

    // Remove existing roles for the user
    const { error: deleteError } = await supabase.from("user_roles").delete().eq("user_id", userId)

    if (deleteError) {
      console.error("Error deleting old roles:", deleteError.message)
      return { success: false, error: "Failed to clear old user roles." }
    }

    // Insert new role
    const { error: insertError } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole })

    if (insertError) {
      console.error("Error inserting new role:", insertError.message)
      return { success: false, error: "Failed to assign new role." }
    }

    return { success: true }
  } catch (e: any) {
    console.error("Server action error (updateUserRole):", e.message)
    return { success: false, error: e.message || "An unexpected error occurred." }
  }
}

export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { roles } = await getUserSessionAndRoles()
    if (!roles.includes("admin")) {
      return { success: false, error: "Forbidden: Only admins can delete users." }
    }

    const supabase = createClient()

    // Delete user from Supabase Auth (this will cascade delete from user_roles due to FK)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId)

    if (authError) {
      console.error("Error deleting auth user:", authError.message)
      return { success: false, error: authError.message || "Failed to delete user." }
    }

    return { success: true }
  } catch (e: any) {
    console.error("Server action error (deleteUser):", e.message)
    return { success: false, error: e.message || "An unexpected error occurred." }
  }
}
