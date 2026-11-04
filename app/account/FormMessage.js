// The error or success line under an account form. role="alert" makes screen
// readers announce errors; role="status" announces success more politely.

export default function FormMessage({ id, state }) {
  if (state.error) {
    return (
      <p id={id} role="alert" className="text-sm text-red-600 dark:text-red-400">
        {state.error}
      </p>
    );
  }

  if (state.success) {
    return (
      <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
        {state.success}
      </p>
    );
  }

  return null;
}
