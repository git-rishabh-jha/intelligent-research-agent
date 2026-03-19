type Props = {
  id: number;
  title: string;
  user: string;
  uploadedAt: string;
  isOwner: boolean;
  onDelete: (id: number) => void;
  onView: () => void;
};

export default function DocumentTile({
  id,
  title,
  user,
  uploadedAt,
  isOwner,
  onDelete,
  onView
}: Props) {
  return (
    <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 hover:border-emerald-500 transition">

      <h2 className="text-lg font-semibold text-white mb-2 truncate">
        {title}
      </h2>

      <p className="text-sm text-slate-400 mb-1">
        Uploaded by: <span className="text-emerald-400">{user}</span>
      </p>

      <p className="text-xs text-slate-500 mb-4">
        {new Date(uploadedAt).toLocaleString()}
      </p>

      <div className="flex justify-between items-center">

        {/* View */}
        <button
          onClick={onView}
          className="text-blue-400 hover:underline"
        >
          View
        </button>

        {/* Delete (only owner) */}
        {isOwner && (
          <button
            onClick={() => onDelete(id)}
            className="text-red-400 hover:text-red-500"
          >
            Delete
          </button>
        )}

      </div>
    </div>
  );
}