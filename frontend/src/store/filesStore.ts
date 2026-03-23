import { create } from 'zustand';
import type { FileAttachment, FileEntityType } from '@/types';
import { files as initialFiles } from '@/data/mock';
import { useUsersStore } from '@/store/usersStore';

function generateId(): string {
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getUserName(userId: string): string {
  return useUsersStore.getState().getUserName(userId);
}

interface FilesState {
  files: FileAttachment[];
  getFilesByEntity: (entityType: FileEntityType, entityId: string) => FileAttachment[];
  addFile: (file: Omit<FileAttachment, 'id' | 'uploadedAt' | 'uploadedBy' | 'uploadedByName'> & { uploadedBy: string }) => FileAttachment;
  deleteFile: (id: string) => void;
  getAllFiles: () => FileAttachment[];
}

export const useFilesStore = create<FilesState>((set, get) => ({
  files: [...initialFiles],

  getFilesByEntity: (entityType, entityId) => {
    return get().files.filter(
      (f) => f.entityType === entityType && f.entityId === entityId
    );
  },

  addFile: (fileData) => {
    const now = new Date().toISOString();
    const newFile: FileAttachment = {
      ...fileData,
      id: generateId(),
      uploadedAt: now,
      uploadedBy: fileData.uploadedBy,
      uploadedByName: getUserName(fileData.uploadedBy),
    };
    set((state) => ({ files: [newFile, ...state.files] }));
    return newFile;
  },

  deleteFile: (id) => {
    set((state) => ({
      files: state.files.filter((f) => f.id !== id),
    }));
  },

  getAllFiles: () => get().files,
}));
