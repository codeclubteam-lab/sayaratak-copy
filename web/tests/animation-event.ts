// jsdom has no AnimationEvent, so React would listen for a vendor-prefixed name and never see `animationend`. This stub makes it behave like a browser. It is its own setup file because it must run before anything imports react-dom.
if (
  typeof window !== "undefined" &&
  typeof Reflect.get(window, "AnimationEvent") !== "function"
) {
  Object.defineProperty(window, "AnimationEvent", {
    configurable: true,
    writable: true,
    value: class extends Event {},
  })
}
