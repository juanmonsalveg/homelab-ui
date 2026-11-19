import { Avatar, type AvatarProps, type ElementProps } from '@mantine/core'
import type { Ref } from 'react'
import { useLocale } from './locale.js'
import { initial } from './person.js'

export interface PersonAvatarProps
  extends
    Omit<AvatarProps, 'name' | 'color' | 'children'>,
    ElementProps<'div', keyof AvatarProps> {
  /** The person's name as shown: their display name, or their username without one (personName). */
  name?: string
  ref?: Ref<HTMLDivElement>
}

/**
 * Someone's avatar, the same wherever they appear (README.md §6): the first letter of their name,
 * in a colour Mantine picks from the name. Without a name, Mantine's placeholder. It takes a ref and
 * the rest of Avatar's props, so a Tooltip can wrap it.
 */
export function PersonAvatar({ name, ...props }: PersonAvatarProps) {
  const { locale } = useLocale()
  return (
    <Avatar {...props} name={name} color={name ? 'initials' : undefined}>
      {name ? initial(name, locale) : undefined}
    </Avatar>
  )
}
