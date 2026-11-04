import { requireUser } from "@/lib/session";
import ChangePasswordForm from "./ChangePasswordForm";
import DeleteAccountForm from "./DeleteAccountForm";
import NameForm from "./NameForm";

export const metadata = {
  title: "Account",
};

export default async function AccountPage() {
  // Same real login check as /tasks (proxy.js only looks for a cookie).
  const user = await requireUser();

  return (
    <section className="space-y-10">
      <div>
        <h1 className="text-3xl font-semibold">Account</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">Signed in as {user.email}</p>
      </div>

      <section aria-labelledby="profile-heading" className="space-y-3">
        <h2 id="profile-heading" className="text-xl font-semibold">
          Profile
        </h2>
        <NameForm name={user.name} />
      </section>

      <section aria-labelledby="password-heading" className="space-y-3">
        <h2 id="password-heading" className="text-xl font-semibold">
          Password
        </h2>
        <ChangePasswordForm />
      </section>

      <section
        aria-labelledby="delete-heading"
        className="space-y-3 rounded border border-red-300 p-4 dark:border-red-900"
      >
        <h2 id="delete-heading" className="text-xl font-semibold text-red-700 dark:text-red-400">
          Delete account
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Deletes your account and all of your tasks for good. This can&apos;t be undone.
        </p>
        <DeleteAccountForm />
      </section>
    </section>
  );
}
