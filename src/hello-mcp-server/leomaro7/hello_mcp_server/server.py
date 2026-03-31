from fastmcp import FastMCP

mcp = FastMCP("hello-mcp-server")


@mcp.tool()
def hello(name: str = "World") -> str:
    """Greet someone by name.

    Args:
        name: The name of the person to greet.
    """
    return f"Hello, {name}! This is hello-mcp-server."


@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two numbers together.

    Args:
        a: The first number.
        b: The second number.
    """
    return a + b


def main():
    mcp.run()


if __name__ == "__main__":
    main()
