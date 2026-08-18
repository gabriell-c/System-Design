import { useState } from 'react';
import { useProjectStore } from '@/lib/project-store';
import { useAuthStore } from '@/lib/auth-store';

export default function DiagramSidebar() {
  const { projects, activeProjectId, createProject, setActiveProject, deleteProject } =
    useProjectStore();
  const { isAuthenticated } = useAuthStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createProject(newName.trim());
    setNewName('');
    setShowCreate(false);
  };

  if (!isAuthenticated) return null;

  return (
    <aside className="w-56 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col">
      {/* Header */}
      <div className="px-3 py-3 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Projects</span>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="w-6 h-6 flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            title="New Project"
          >
            +
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="mt-2 flex gap-1">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Project name..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <button
              onClick={handleCreate}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white transition-colors"
            >
              Create
            </button>
          </div>
        )}
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto py-1">
        {projects.length === 0 && !showCreate ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-zinc-500">No projects yet</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-2 text-xs text-blue-400 hover:text-blue-300"
            >
              Create your first project
            </button>
          </div>
        ) : (
          projects.map(project => (
            <div
              key={project.id}
              className={`group flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-zinc-800 transition-colors ${
                activeProjectId === project.id ? 'bg-zinc-800 border-l-2 border-blue-500' : ''
              }`}
              onClick={() => setActiveProject(project.id)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200 truncate">{project.name}</p>
                <p className="text-xs text-zinc-500">
                  {project.diagrams?.length ?? 0} diagrams
                </p>
              </div>
              <button
                onClick={e => {
                  e.stopPropagation();
                  if (confirm(`Delete project "${project.name}"?`)) {
                    deleteProject(project.id);
                  }
                }}
                className="opacity-0 group-hover:opacity-100 px-1 text-zinc-500 hover:text-red-400 transition-all"
                title="Delete"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-zinc-800">
        <p className="text-xs text-zinc-600 text-center">
          {projects.length} project{projects.length !== 1 ? 's' : ''}
        </p>
      </div>
    </aside>
  );
}
