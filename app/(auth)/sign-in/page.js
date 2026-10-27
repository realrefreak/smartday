import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import SignInForm from "../SignInForm";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await getCurrentUser()) {
    redirect("/tasks");
  }

  return (
    <section className="mx-auto max-w-sm space-y-6">
      <h1 className="text-3xl font-semibold">Sign in</h1>
      <SignInForm />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        New to SmartDay?{" "}
        <Link href="/sign-up" className="underline">Create an account</Link>
      </p>
    </section>
  );
}
