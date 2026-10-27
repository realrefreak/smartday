import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import SignUpForm from "../SignUpForm";

export const metadata = { title: "Sign up" };

export default async function SignUpPage() {
  // Already signed in? Nothing to do here.
  if (await getCurrentUser()) {
    redirect("/tasks");
  }

  return (
    <section className="mx-auto max-w-sm space-y-6">
      <h1 className="text-3xl font-semibold">Create your account</h1>
      <SignUpForm />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/sign-in" className="underline">Sign in</Link>
      </p>
    </section>
  );
}
