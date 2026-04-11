interface Props {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export default function MobileTopHeader({ title, subtitle, actions }: Props) {
  return (
    <div className="px-5 pt-4 pb-3 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950 flex-shrink-0 md:hidden">
      <div className="flex-1 min-w-0">
        <h1 className="text-[28px] font-extrabold text-zinc-900 dark:text-white tracking-tight leading-none">{title}</h1>
        {subtitle && <div className="text-xs text-zinc-500 mt-1">{subtitle}</div>}
      </div>
      {actions && <div className="flex gap-2 items-center flex-shrink-0">{actions}</div>}
    </div>
  )
}
