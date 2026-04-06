---
layout: post
title: Markdown Test
---

this is the test page.

## Base 작성법

### 1.1 Header

```text
# H1
## H2
### H3
#### H4
##### H5
###### H6
```

# H1
## H2
### H3
#### H4
##### H5
###### H6

typical text

### 1.2 Texts

Some texts

**Bold**

*Italic*

~~Cancelline~~

### 1.3 Block Quote

> First blockquote
> > Second blockquote
> > > Third blockquote
> > > > Fourth blockquote

### 1.4 List

ordered list

1. a
2. b
3. c

unordered list

- Dot
- Dot
- Dot

* First
  - Second
    + Third

- [x] To do List 1
- [x] To do List 2
- [x] Done, (Check : Alt + C)

### 1.5 Code

`Hello World`

```c
int main(){std::cout << "hello world!" << std::endl;}
```

```c++
#include <iostream>
```

```ruby
def print_hi(name)
  puts "Hi, #{name}"
end
print_hi('Tom')
#=> prints 'Hi, Tom' to STDOUT.
```

### 1.6 Link

- 내부 링크 [보여지는 텍스트](#16-link)
- 외부 링크 1) [직접 링크](www.google.com)
- 외부 링크 2) [하단 링크][1]

### 1.7 Image

```text
- ![Text](path/to/img.jpg)
- ![Text](path/to/img.jpg "Optional title")
```

### 1.8 Table

| t   | a   |
| --- | --- |
| a   | b   |
| c   | d   |

VS Code : Alt + Shift + F

---

[1]: https://www.google.com

## Link

[markdown quick reference](https://wordpress.com/support/markdown-quick-reference/)
