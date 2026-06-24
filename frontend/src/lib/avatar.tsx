import Avvvatars from 'avvvatars-react';

export function AvatarImage({ name, avatar, size = 32 }: { name: string; avatar?: string | null; size?: number }) {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt=""
        className="size-full rounded-full object-cover"
      />
    );
  }
  return (
    <Avvvatars
      value={name.trim()}
      style="shape"
      size={size}
      radius={size / 2}
    />
  );
}