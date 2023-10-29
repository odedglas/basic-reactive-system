
# Basic Javascript Reactive system

## Reactive Primitives

Our `reactive` system will include 3 kinds of `Primitives` which will be the foundations of our reactive system API:

- `Signals` / `createSignal`
- `Effects` / `createEffect`
- `Memos` / `createMemo`

### Signals

`Signals` are the most basic `Primitive` our system will hold, they will hold a `getter` and a `setter` for an initial given value.

They are created via the `createSignal()` API which accepts an `initialValue` as argument.

```js {1}
const [count, setCount] = createSignal(3); // Creating singal with 3 as initialValue
console.log("Initial Read", count()); // Count is 3

setCount(5);
console.log("Updated Read", count()); // Now counts will be 5

setCount(count() * 2);
console.log("Updated Read", count()); // Count is 10
```

```shell title="Output"
Initial read 3
Updated Read 5
Updated Read 10
```

### Effects

Effects are functions that wrap reads of our `Signal` and re-execute whenever a dependent `Signal's` value changes.

They are created via the `createEffect` API which accepts a single argument which is a function.

This is useful for creating side effects, like **rendering** flow that potentially cna happen in any UI framework, meaning a state can change, and our `DOM` will get re-rendered.

The `createEffect` API **runs** the given method on creation.

```js {5}
console.log("1. Create Signal");
const [count, setCount] = createSignal(0);

console.log("2. Create Effect");
createEffect(() => console.log("[Effect] The count is", count())); // Runs the effect once its created.

console.log("3. Set count to 5");
setCount(5); // Setting new count value wil re-trigger the effect

console.log("4. Set count to 10");
setCount(10); // Setting new count value wil re-trigger the effect
```

In the above example, our effect will run 3 times:

Once upon `Effect` creation, than two more times on every update of `count` signal.

```shell title="Output"
1. Create Signal
2. Create Effect
[Effect] The count is 0
3. Set count to 5
[Effect] The count is 5
4. Set count to 10
[Effect] The count is 10
```

### Memos

Finally, Memos are cached derived values. They share the properties of both `Signals` and `Effects`. They track their own dependent `Signals`, re-executing only when those change, and are trackable `Signals` themselves.

They are create using the `createMemo` API which have same signature as `createEffect` meaning it gets a single function as argument and also **runs** the given function once called.

```js {6,12,13}
console.log("1. Create Signals");
const [firstName, setFirstName] = createSignal("John");
const [lastName, setLastName] = createSignal("Smith");

console.log("2. Create Memo");
const fullName = createMemo(() => {
    console.log("[Memo] Composing fullName");
    return `${firstName()} ${lastName()}`
});

console.log("3. Create Effects");
createEffect(() => console.log("[Effect] My name is", fullName()));
createEffect(() => console.log("[Effect] Hello", fullName()));

console.log("4. Set new firstName");
setFirstName("Jacob");
```

Note, that before `setFirstName` setter is called, our memoized function **runs only once,** although it was accessed **twice** in each effect.

If we wouldn't wrap the `fullName` function with `createMemo` API, it would have **run twice** by the same point.

```shell title="Output"
1. Create Signals
2. Create Memo
[Memo] Creating/Updating fullName
3. Create Effects
[Effect] My name is John Smith
[Effect] Hello John Smith
4. Set new firstName
[Memo] Creating/Updating fullName
[Effect] My name is Jacob Smith
[Effect] Hello Jacob Smith
```

## Considerations

These below points was considered when designing this system:

### Synchronous code

The `Reactive` should system support **synchronous** code alone, there is no need to track `async` or any delayed code.

This means that following this code:

```js {6,9}
console.log("1. Create Signals");
const [count, setCount] = createSignal(0);
const [other, setOther] = createSignal('')

console.log("2. Create Effect");
createEffect(async() => {
    console.log('[Effect] Count is :', count()); // Count signal is tracked.

    await Promise.resolve();

    console.log('[Effect] Other is: ', other()) // Other signal is not tracked as it's after an asnyc code.
});

console.log("3. Manipulate Signals");
setCount(5);

setOther('Hola');
```

Note that in this case, `setOther` **will not re-trigger** the created effect, as it's being used **after an asynchronous code** and thus **will not** be tracked.

```shell title="Output"
1. Create Signals
2. Create Effec
[Effect] Count is : 0
3. Manipulate Signals
[Effect] Count is : 5
[Effect] Other is:  Hola
[Effect] Other is:  Hola
```

:::info
`setCount` will trigger the effect normally as it's been used within **synchronous** code.
:::

### Dynamic dependencies tracking

`Effects` needs to have the ability to **dynamically** listen to `Signals` and be triggered accordingly.

Let's look at the following code to demonstrate the meaning of it:

```js {10,15,17} showLineNumbers
console.log('1. Create Signal');
const [count, setCount] = createSignal(0);
const [other, setOther] = createSignal('Hey');

console.log('2. Create Effect');
createEffect(() => {
    console.log('[Effect] The count is', count());

    if (count() > 5) {
        console.log('[Effect] Test is', other());
    }
});

console.log('3. Manipulate Signals');
setOther('Tal');
setCount(20);
setOther('Eitan');
```

#### Walkthrough

1. We create two Signals - `count`/`other`.
2. When our `Effect` is created, the `count()` signal is less than `5` and **thus we will not read** the `other()` `Signal`.
3. Line `15` - `setOther('Tal')` **will not cause the `Effect` to re-execute** as at this point, `other` isn't tracked by him.
4. Line `16` sets `count` signal to `20` which **cause the `Effect` to re-execute** only this time, it will also read `other` signal.
5. Line `17` - `setOther('Eitan')` will now **cause the `Effect` to re-execute**.

This demonstrates the requirement of `Effects` having **dynamic signals dependencies**

The above code output will be:

```shell title="Output"
1. Create Signal
2. Create Effect
[Reaction] The count is 0
3. Manipulate Signals
[Reaction] The count is 20
[Reaction] Test is Tal
[Reaction] The count is 20
[Reaction] Test is Eitan
```

## Code Examples

Here is some more code scenarios which suppose to help you better understand more aspects of this `Reactive` system.

### Effect sees through

`Effects` has the ability to "see through" other functions signals, for example:

```js
const [count, setCount] = createSignal(0);

const getDoubleCount = () => count() * 2;

createEffect(() => {
    console.log('[Effect] Double count is', getDoubleCount())
});
```

In this example, even-tho   the `Effect` **isn't** calling directly to `count` signal, it still tracks it as it's being used within the `getDoubleCount` method.

### Memos behave as Effects

General speaking, `Memo` acts same as `Effect` in a manner they both track signals dependencies called within.

The main difference is that `Memo` returns a `function` you can call later on, unlike `Effect`.

```js {6,11}
console.log("1. Create");
const [firstName, setFirstName] = createSignal("John");
const [lastName, setLastName] = createSignal("Smith");
const [showFullName, setShowFullName] = createSignal(true);

const displayName = createMemo(() => {
    if (!showFullName()) return firstName();
    return `${firstName()} ${lastName()}`
});

createEffect(() => console.log("My name is", displayName()));

console.log("2. Set showFullName: false ");
setShowFullName(false);

console.log("3. Change lastName");
setLastName("Legend");

console.log("4. Set showFullName: true");
setShowFullName(true);
```

:::note
In this example you can also see that `Effects` can **track `Memos`!**.
:::

```shell title="Output"
1. Create
My name is John Smith
2. Set showFullName: false
My name is John
3. Change lastName
4. Set showFullName: true
My name is John Legend
```
