declare namespace wx {
  interface DataSet {
    [k: string]: string
  }

  interface EventTarget {
    id: string
    dataset: DataSet
  }

  interface BaseEvent {
    type: string
    timeStamp: number
    target: EventTarget
    currentTarget: EventTarget
    mark: DataSet
  }

  interface Touch {
    identifier: number
    pageX: number
    pageY: number
    clientX: number
    clientY: number
  }

  interface CanvasTouch {
    identifier: number
    x: number
    y: number
  }

  interface TouchEvent extends BaseEvent {
    touches: Touch[]
    changedTouches: Touch[]
  }

  interface CanvasTouchEvent {
    type: string
    timeStamp: number
    target: EventTarget
    mark: DataSet
    touches: CanvasTouch[]
    changedTouches: CanvasTouch[]
  }

  interface InputChangeEvent extends BaseEvent {
    detail: {
      value: string
      cursor: any
      keyCode: number
    }
  }

  interface CheckBoxGroupChangeEvent extends BaseEvent {
    detail: {
      value: string[]
    }
  }

  type RadioGroupChangeEvent = CheckBoxGroupChangeEvent

}