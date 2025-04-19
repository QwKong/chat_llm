import { useState } from 'react';
import { FaBars, FaPlus } from 'react-icons/fa';

function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div
      className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${
        isCollapsed ? 'w-12' : 'w-48'
      }`}
    >
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        {isCollapsed ? (
          <button
            onClick={toggleSidebar}
            className="p-2 text-gray-600 hover:text-gray-800"
          >
            <FaBars />
          </button>
        ) : (
          <>
            <button
              onClick={onNewConversation}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              新对话
            </button>
            <button
              onClick={toggleSidebar}
              className="ml-2 p-2 text-gray-600 hover:text-gray-800"
            >
              <FaBars />
            </button>
          </>
        )}
      </div>
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto">
          {conversations
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map((conversation) => (
              <div
                key={conversation.id}
                className={`p-3 border-b border-gray-200 cursor-pointer flex justify-between items-center ${
                  conversation.id === currentConversationId ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <div
                  onClick={() => onSelectConversation(conversation.id)}
                  className="flex-1 truncate"
                >
                  {conversation.title}
                  <div className="text-xs text-gray-500">
                    {new Date(conversation.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => onDeleteConversation(conversation.id)}
                  className="text-red-500 hover:text-red-600"
                >
                  删除
                </button>
              </div>
            ))}
        </div>
      )}
      {isCollapsed && (
        <div className="p-4">
          <button
            onClick={onNewConversation}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FaPlus />
          </button>
        </div>
      )}
    </div>
  );
}

export default Sidebar;