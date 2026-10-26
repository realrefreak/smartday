// In-memory task store.
// Tasks live in this module's variable, so they disappear when the server
// restarts. Stage 3 replaces the insides with a database; the function names
// and shapes stay the same, so pages using them won't need to change.

let tasks = [];

// Return a copy so callers can't change the stored task by accident.
function copy(task) {
  return { ...task };
}

// Functions are async now because database calls will be async later.
export async function listTasks() {
  return tasks.map(copy);
}

export async function addTask(title) {
  const task = {
    id: crypto.randomUUID(),
    title,
    completed: false,
    createdAt: new Date().toISOString(),
  };

  tasks.push(task);
  return copy(task);
}

// Flips completed on/off. Returns the updated task, or null if the id is unknown.
export async function toggleTask(id) {
  const task = tasks.find((t) => t.id === id);

  if (!task) {
    return null;
  }

  task.completed = !task.completed;
  return copy(task);
}

// Empties the store. Used by tests so each test starts fresh.
export async function clearTasks() {
  tasks = [];
}
