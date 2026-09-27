/** Visual feedback runs off the audio clock, straight on the DOM. */
export function flash(root: HTMLElement | null, note: string) {
  const el = root?.querySelector<HTMLElement>(`[data-note="${note}"]`)
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el?.classList.add('sounding')
    setTimeout(() => el?.classList.remove('sounding'), 160)
    return
  }
  if (el.classList.contains('string')) {
    el.querySelector('.string-line')?.animate(
      [
        { transform: 'scaleY(2.6)', filter: 'brightness(2.1)', boxShadow: '0 0 12px 1px rgb(243 222 170 / 0.9)' },
        { transform: 'scaleY(1.4)', filter: 'brightness(1.5)', boxShadow: '0 0 6px 0 rgb(243 222 170 / 0.45)', offset: 0.25 },
        { transform: 'scaleY(1)', filter: 'brightness(1)', boxShadow: '0 1px 1px 0 rgb(0 0 0 / 0.55)' },
      ],
      { duration: 900, easing: 'cubic-bezier(.2,.7,.3,1)' },
    )
    el.animate([{ backgroundColor: 'rgb(236 214 160 / 0.16)' }, { backgroundColor: 'rgb(236 214 160 / 0)' }], {
      duration: 520,
      easing: 'ease-out',
    })
  } else {
    el.classList.add('sounding')
    el.animate([{ transform: 'scale(0.975)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' })
    const done = () => el.classList.remove('sounding')
    clearTimeout(Number(el.dataset.timer))
    el.dataset.timer = String(setTimeout(done, 170))
  }
}
