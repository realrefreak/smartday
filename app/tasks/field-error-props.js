// Accessibility attributes for an input, based on a form action's state.
// Marks the input invalid and points screen readers at the error message when
// the error is about this field. An error with no field (e.g. "signed out")
// applies to every input in the form.
export function fieldErrorProps(state, field, errorId) {
  const isInvalid = state.error && (state.field === field || !state.field);
  return isInvalid ? { "aria-invalid": true, "aria-describedby": errorId } : {};
}
