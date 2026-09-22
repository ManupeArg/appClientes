"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  if (error) redirect("/login?error=" + encodeURIComponent("Email o contraseña incorrectos"));
  redirect("/");
}

export async function registro(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
    options: { data: { nombre: String(formData.get("nombre")) } },
  });
  if (error) redirect("/registro?error=" + encodeURIComponent(error.message));
  if (data.session) redirect("/");
  redirect("/login?ok=" + encodeURIComponent("Cuenta creada. Revisá tu email para confirmarla y después ingresá."));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
